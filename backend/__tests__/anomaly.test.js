const { detectAnomalies } = require("../functions/anomaly");

describe("Predictive Anomaly Engine", () => {
  it("should not generate alerts if historical data is less than 3 months", () => {
    const data = {
      "Bengaluru Urban|Cyber Crime": [10, 15] // Only 2 months
    };
    const alerts = detectAnomalies(data);
    expect(alerts.length).toBe(0);
  });

  it("should generate a High Risk alert for Z-score > 2.0", () => {
    // 12 months history. First 11 months are low variance.
    // 11 months of ~10 cases per month. Mean ~10. StdDev ~0.
    // 12th month has 30 cases.
    const data = {
      "Bengaluru Urban|Cyber Crime": [10, 11, 9, 10, 10, 11, 10, 9, 10, 10, 10, 30]
    };
    const alerts = detectAnomalies(data);
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe("High Risk");
    expect(alerts[0].message).toMatch(/Predictive Alert/);
    expect(alerts[0].message).toMatch(/Cyber Crime/);
    expect(alerts[0].severity).toBe("high");
  });

  it("should generate a Warning alert for Z-score between 1.2 and 2.0", () => {
    // 11 months of ~20 cases per month. Mean ~20. StdDev ~0.7.
    // 12th month has 22 cases. (22 - 20) / 0.7 = 2.8. Wait, I'll use 22.
    // Wait, let's use carefully crafted values.
    // 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10. Mean 10, stddev 0.
    // Wait, stddev 0 would cause division by zero or something? I added a check for 0.
    // 9, 11. Mean 10, var 1. StdDev 1.
    // (12 - 10) / 1 = 2.0. So 12 gives exactly 2.0.
    // (11.5 - 10) / 1 = 1.5. So 11.5 gives 1.5.
    const data = {
      "Mangaluru City|Financial Fraud": [9, 11, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11, 12] 
      // wait, the length doesn't matter. mean of [9,11,9,11,...] is 10. Stddev is 1.
      // let's pass an array where last element is 11.5 (we can use decimals just to test the logic).
    };
    const alerts = detectAnomalies(data);
    // Actually, 12 will result in (12-10)/1 = 2.0. 2.0 is NOT > 2.0, so it will fall into > 1.2.
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe("Warning");
    expect(alerts[0].message).toMatch(/Emerging Trend/);
    expect(alerts[0].severity).toBe("medium");
  });

  it("should not generate an alert if Z-score is <= 1.2", () => {
    // 9, 11... mean=10, stddev=1.
    // 12th month is 11. Z-score = (11-10)/1 = 1.0.
    const data = {
      "Mysuru City|Theft": [9, 11, 9, 11, 9, 11, 11]
    };
    const alerts = detectAnomalies(data);
    expect(alerts.length).toBe(0);
  });
});

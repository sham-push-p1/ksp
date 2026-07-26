const request = require("supertest");
const app = require("../server");
const db = require("../db/index");

describe("Chat Routes", () => {
  let adminSessionCookie = "";

  beforeAll(async () => {
    // Login as Admin
    const adminRes = await request(app)
      .post("/api/login")
      .send({ username: "admin", password: "admin" });
    adminSessionCookie = adminRes.headers["set-cookie"][0].split(";")[0];
  });

  describe("POST /api/chat", () => {
    it("should reject malicious SQL injection payload in chat", async () => {
      // It won't directly hit SQL injection natively if it uses intent classification,
      // but let's test a structured query that attempts to inject
      const response = await request(app)
        .post("/api/chat")
        .set("Cookie", adminSessionCookie)
        .send({
          question: "Show cases DROP TABLE SystemUsers;"
        });
        
      // Even if intent is general or structured, the system should handle it.
      // If it tries to run SQL and sees DROP TABLE, it gets intercepted.
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Blocked keyword/i);
      
      // If it went to structured_query and tried to execute DROP TABLE, it would be blocked by validateSQL.
      // It will either return an error or fallback, but it should NOT execute DROP.
      if (response.body.error) {
        expect(response.body.error).toMatch(/Blocked keyword: DROP/i);
      } else {
        expect(response.body.intent).toBeDefined();
      }
    }, 15000); // Increased timeout for LLM
  });
});

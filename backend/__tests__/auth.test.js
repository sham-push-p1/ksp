const request = require("supertest");
const app = require("../server");
const db = require("../db/index");

describe("Auth Routes", () => {
  // We use the existing local-dev.db which is seeded with demo users.
  // Tests should not mutate the database state in a way that breaks other tests.
  
  describe("POST /api/login", () => {
    it("should return 200 and a user object for valid credentials", async () => {
      const response = await request(app)
        .post("/api/login")
        .send({
          username: "admin",
          password: "admin"
        });
        
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("username", "admin");
      expect(response.body.user).toHaveProperty("role", "scrb_analyst");
      
      // Ensure a cookie was set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith("ksp_session="))).toBeTruthy();
    });

    it("should return 401 for invalid password", async () => {
      const response = await request(app)
        .post("/api/login")
        .send({
          username: "admin",
          password: "wrongpassword123"
        });
        
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid username or password");
    });

    it("should return 401 for non-existent user", async () => {
      const response = await request(app)
        .post("/api/login")
        .send({
          username: "thisuserdoesnotexist",
          password: "password123"
        });
        
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid username or password");
    });

    it("should return 400 for missing fields (Zod validation)", async () => {
      const response = await request(app)
        .post("/api/login")
        .send({
          username: "admin"
          // missing password
        });
        
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password.*invalid input|password.*required/i);
    });
  });

  describe("POST /api/logout", () => {
    it("should clear the session cookie and return 200", async () => {
      const response = await request(app).post("/api/logout");
      expect(response.status).toBe(200);
      
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes("ksp_session=;"))).toBeTruthy();
    });
  });
});

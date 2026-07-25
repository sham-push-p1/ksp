const request = require("supertest");
const app = require("../server");
const db = require("../db/index");

describe("Admin Routes", () => {
  let adminSessionCookie = "";
  let officerSessionCookie = "";

  beforeAll(async () => {
    // 1. Login as Admin
    const adminRes = await request(app)
      .post("/api/login")
      .send({ username: "admin", password: "admin" });
    adminSessionCookie = adminRes.headers["set-cookie"][0].split(";")[0];

    // 2. Login as Officer
    const officerRes = await request(app)
      .post("/api/login")
      .send({ username: "sp_blr", password: "sp_blr" });
    officerSessionCookie = officerRes.headers["set-cookie"][0].split(";")[0];
  });

  afterAll(async () => {
    // Clean up any test users created
    await db("SystemUsers").where({ Username: "testuser99" }).del();
  });

  describe("GET /api/admin/users", () => {
    it("should allow ADMIN to fetch users", async () => {
      const response = await request(app)
        .get("/api/admin/users")
        .set("Cookie", adminSessionCookie);
        
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it("should block non-ADMIN from fetching users", async () => {
      const response = await request(app)
        .get("/api/admin/users")
        .set("Cookie", officerSessionCookie);
        
      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/Access denied/i);
    });
  });

  describe("POST /api/admin/users", () => {
    it("should allow ADMIN to create a new user", async () => {
      const response = await request(app)
        .post("/api/admin/users")
        .set("Cookie", adminSessionCookie)
        .send({
          username: "testuser99",
          password: "testpassword",
          role: "OFFICER",
          name: "Test Officer",
          districtName: "Bengaluru Urban",
          stationName: ""
        });
        
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("success", true);
    });

    it("should prevent duplicate usernames", async () => {
      const response = await request(app)
        .post("/api/admin/users")
        .set("Cookie", adminSessionCookie)
        .send({
          username: "testuser99",
          password: "testpassword",
          role: "OFFICER",
          name: "Test Officer 2",
        });
        
      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Username already exists");
    });
  });
});

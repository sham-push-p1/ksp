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

  describe("KnowledgeBase Routes", () => {
    let testDocId = null;

    it("should allow ADMIN to fetch knowledge base documents", async () => {
      const response = await request(app)
        .get("/api/admin/knowledge")
        .set("Cookie", adminSessionCookie);
        
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("docs");
      expect(Array.isArray(response.body.docs)).toBe(true);
    });

    it("should allow ADMIN to add a new knowledge base document", async () => {
      const response = await request(app)
        .post("/api/admin/knowledge")
        .set("Cookie", adminSessionCookie)
        .send({
          title: "Test Policy Document",
          category: "Policy",
          content: "This is a test policy document for the RAG system."
        });
        
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("id");
      testDocId = response.body.id;
    }, 15000); // Increased timeout for LLM embedding generation

    it("should block non-ADMIN from adding knowledge base documents", async () => {
      const response = await request(app)
        .post("/api/admin/knowledge")
        .set("Cookie", officerSessionCookie)
        .send({
          title: "Hacked Document",
          category: "Policy",
          content: "Should not be allowed."
        });
        
      expect(response.status).toBe(403);
    });

    it("should allow ADMIN to delete a knowledge base document", async () => {
      expect(testDocId).not.toBeNull();
      const response = await request(app)
        .delete(`/api/admin/knowledge/${testDocId}`)
        .set("Cookie", adminSessionCookie);
        
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });
});

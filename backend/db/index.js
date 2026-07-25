/**
 * db/index.js — Database initialization, seeding, migrations, and session cleanup.
 * Exports the configured better-sqlite3 Database instance for use across routes.
 */

const Database = require("better-sqlite3");
const bcrypt   = require("bcrypt");
const knexConfig = require("../knexfile");
const knex = require("knex")(knexConfig[process.env.NODE_ENV || 'development']);

const sqliteDb = new Database("./local-dev.db");

// ─── Table Creation ──────────────────────────────────────────────────────────

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS SystemUsers (
    UserID TEXT PRIMARY KEY,
    Username TEXT UNIQUE,
    PasswordHash TEXT,
    Role TEXT,
    Name TEXT,
    DistrictName TEXT,
    StationName TEXT
  );
  CREATE TABLE IF NOT EXISTS UserSessions (
    Token TEXT PRIMARY KEY,
    UserID TEXT,
    Username TEXT,
    Role TEXT,
    Name TEXT,
    DistrictName TEXT,
    StationName TEXT,
    CreatedAt TEXT,
    ExpiresAt TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS CaseSummaryFlat (
    CaseMasterID INTEGER, CrimeNo TEXT, CaseNo TEXT,
    CrimeRegisteredDate TEXT, IncidentFromDate TEXT, IncidentToDate TEXT,
    Latitude REAL, Longitude REAL, BriefFacts TEXT,
    CaseCategoryName TEXT, GravityOffence TEXT,
    CrimeMajorHead TEXT, CrimeMinorHead TEXT, CaseStatus TEXT,
    PoliceStationName TEXT, DistrictName TEXT, StateName TEXT,
    RegisteringOfficerName TEXT, RegisteringOfficerRank TEXT,
    CourtName TEXT, EmbeddingVec TEXT
  );
  CREATE TABLE IF NOT EXISTS AccusedSummaryFlat (
    AccusedMasterID INTEGER, CaseMasterID INTEGER, CrimeNo TEXT,
    AccusedName TEXT, AgeYear INTEGER, Gender TEXT, PersonID TEXT,
    ArrestDate TEXT, ArrestDistrict TEXT, ArrestState TEXT,
    ArrestingOfficerName TEXT, ArrestingOfficerRank TEXT,
    ProducedInCourt TEXT, CrimeMajorHead TEXT, CrimeMinorHead TEXT,
    PoliceStationName TEXT, DistrictName TEXT
  );
  CREATE TABLE IF NOT EXISTS VictimSummaryFlat (
    VictimMasterID INTEGER, CaseMasterID INTEGER, CrimeNo TEXT,
    VictimName TEXT, AgeYear INTEGER, Gender TEXT, IsPoliceVictim INTEGER,
    CrimeMajorHead TEXT, CrimeMinorHead TEXT,
    PoliceStationName TEXT, DistrictName TEXT, IncidentFromDate TEXT
  );
  CREATE TABLE IF NOT EXISTS ComplainantSummaryFlat (
    ComplainantID INTEGER, CaseMasterID INTEGER, CrimeNo TEXT,
    ComplainantName TEXT, AgeYear INTEGER, Gender TEXT,
    Occupation TEXT, Religion TEXT, Caste TEXT,
    CrimeMajorHead TEXT, CrimeMinorHead TEXT,
    PoliceStationName TEXT, DistrictName TEXT
  );
  CREATE TABLE IF NOT EXISTS QueryAuditLog (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID TEXT, UserRole TEXT, SessionID TEXT,
    Question TEXT, Intent TEXT, GeneratedQuery TEXT,
    ResultCount INTEGER, LatencyMs INTEGER, Timestamp TEXT, Status TEXT
  );
`);

// ─── Migrations ──────────────────────────────────────────────────────────────

try {
  const cols = sqliteDb.prepare("PRAGMA table_info(UserSessions)").all().map(c => c.name);
  if (!cols.includes("ExpiresAt")) {
    sqliteDb.exec("ALTER TABLE UserSessions ADD COLUMN ExpiresAt TEXT");
    console.log("[DB MIGRATION] Added ExpiresAt column to UserSessions.");
  }
} catch (err) {
  console.warn("[DB MIGRATION WARNING]", err.message);
}

// ─── Seed SystemUsers ────────────────────────────────────────────────────────

const systemUserCount = sqliteDb.prepare("SELECT COUNT(*) AS count FROM SystemUsers").get().count;
if (systemUserCount === 0) {
  console.log("[DB] Seeding SystemUsers with bcrypt hashes (cost=12)...");
  const demoUsers = {
    admin:     { userId:"EMP001", role:"scrb_analyst", name:"SCRB Analyst",         districtName:null,              stationName:null, password:"admin" },
    sp_blr:   { userId:"EMP002", role:"sp",           name:"SP Bengaluru Urban",    districtName:"Bengaluru Urban", stationName:null, password:"sp_blr" },
    insp_wf:  { userId:"EMP003", role:"inspector",    name:"Inspector Whitefield",  districtName:"Bengaluru Urban", stationName:"Whitefield", password:"insp_wf" },
    constable:{ userId:"EMP004", role:"constable",    name:"Constable Sharma",      districtName:"Bengaluru Urban", stationName:"Cubbon Park", password:"constable" },
  };
  const insertUser = sqliteDb.prepare(`
    INSERT INTO SystemUsers (UserID, Username, PasswordHash, Role, Name, DistrictName, StationName)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [username, u] of Object.entries(demoUsers)) {
    const hash = bcrypt.hashSync(u.password, 12);
    insertUser.run(u.userId, username, hash, u.role, u.name, u.districtName, u.stationName);
  }
  console.log("[DB] SystemUsers seeded successfully with bcrypt.");
}

// ─── Migrate legacy SHA-256 password hashes to bcrypt ───────────────────────

try {
  const users = sqliteDb.prepare("SELECT UserID, Username, PasswordHash FROM SystemUsers").all();
  const legacyPasswords = { admin:"admin", sp_blr:"sp_blr", insp_wf:"insp_wf", constable:"constable" };
  const updateHash = sqliteDb.prepare("UPDATE SystemUsers SET PasswordHash = ? WHERE UserID = ?");
  let migrated = 0;
  for (const u of users) {
    if (!u.PasswordHash.startsWith("$2b$")) {
      const plaintext = legacyPasswords[u.Username];
      if (plaintext) {
        updateHash.run(bcrypt.hashSync(plaintext, 12), u.UserID);
        migrated++;
      }
    }
  }
  if (migrated > 0) console.log(`[DB MIGRATION] Re-hashed ${migrated} user password(s) to bcrypt.`);
} catch (err) {
  console.warn("[DB MIGRATION bcrypt WARNING]", err.message);
}

// ─── Seed flat tables from seeds/seed-data.json ──────────────────────────────

function loadSeedData() {
  let countC = 0, countA = 0, countV = 0, countCP = 0;
  try { countC  = sqliteDb.prepare("SELECT COUNT(*) AS c FROM CaseSummaryFlat").get().c; } catch {}
  try { countA  = sqliteDb.prepare("SELECT COUNT(*) AS c FROM AccusedSummaryFlat").get().c; } catch {}
  try { countV  = sqliteDb.prepare("SELECT COUNT(*) AS c FROM VictimSummaryFlat").get().c; } catch {}
  try { countCP = sqliteDb.prepare("SELECT COUNT(*) AS c FROM ComplainantSummaryFlat").get().c; } catch {}

  if (countC > 0 && countA > 0 && countV > 0 && countCP > 0) {
    console.log(`[DB] All flat tables loaded (${countC} cases, ${countA} accused, ${countV} victims, ${countCP} complainants)`);
    return;
  }

  try {
    const d = require("../seeds/seed-data.json");
    const chMap  = Object.fromEntries(d.CrimeHead.map(r=>[r.CrimeHeadID, r.CrimeGroupName]));
    const cshMap = Object.fromEntries(d.CrimeSubHead.map(r=>[r.CrimeSubHeadID, r.CrimeHeadName]));
    const catMap = Object.fromEntries(d.CaseCategory.map(r=>[r.CaseCategoryID, r.LookupValue]));
    const gravMap= Object.fromEntries(d.GravityOffence.map(r=>[r.GravityOffenceID, r.LookupValue]));
    const stMap  = Object.fromEntries(d.CaseStatusMaster.map(r=>[r.CaseStatusID, r.CaseStatusName]));
    const unitMap= Object.fromEntries(d.Unit.map(r=>[r.UnitID, r]));
    const distMap= Object.fromEntries(d.District.map(r=>[r.DistrictID, r]));
    const empMap = Object.fromEntries(d.Employee.map(r=>[r.EmployeeID, r]));
    const rankMap= Object.fromEntries(d.Rank.map(r=>[r.RankID, r]));
    const crtMap = Object.fromEntries(d.Court.map(r=>[r.CourtID, r]));
    const arMap  = Object.fromEntries(d.ArrestSurrender.map(r=>[r.AccusedMasterID, r]));
    const occMap = Object.fromEntries(d.OccupationMaster.map(r=>[r.OccupationID, r.OccupationName]));
    const relMap = Object.fromEntries(d.ReligionMaster.map(r=>[r.ReligionID, r.ReligionName]));
    const cstMap = Object.fromEntries(d.CasteMaster.map(r=>[r.caste_master_id, r.caste_master_name]));
    const caseIdx= Object.fromEntries(d.CaseMaster.map(r=>[r.CaseMasterID, r]));

    if (countC === 0) {
      console.log("[DB] Seeding CaseSummaryFlat...");
      const insC = sqliteDb.prepare(`INSERT INTO CaseSummaryFlat VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`);
      sqliteDb.transaction(rows => {
        for (const c of rows) {
          const unit=unitMap[c.PoliceStationID]||{}, dist=distMap[unit.DistrictID]||{};
          const emp=empMap[c.PolicePersonID]||{}, rank=rankMap[emp.RankID]||{};
          const court=crtMap[c.CourtID]||{};
          insC.run(c.CaseMasterID,c.CrimeNo,c.CaseNo,c.CrimeRegisteredDate,
            c.IncidentFromDate,c.IncidentToDate,c.latitude,c.longitude,c.BriefFacts||"",
            catMap[c.CaseCategoryID]||"FIR",gravMap[c.GravityOffenceID]||"",
            chMap[c.CrimeMajorHeadID]||"",cshMap[c.CrimeMinorHeadID]||"",
            stMap[c.CaseStatusID]||"",unit.UnitName||"",dist.DistrictName||"","Karnataka",
            emp.FirstName||"",rank.RankName||"",court.CourtName||"");
        }
      })(d.CaseMaster);
    }

    if (countA === 0) {
      console.log("[DB] Seeding AccusedSummaryFlat...");
      const insA = sqliteDb.prepare(`INSERT INTO AccusedSummaryFlat VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      sqliteDb.transaction(rows => {
        for (const a of rows) {
          const ar=arMap[a.AccusedMasterID]||{}, aDist=distMap[ar.ArrestSurrenderDistrictId]||{};
          const io=empMap[ar.IOID]||{}, ioRank=rankMap[io.RankID]||{};
          const court=crtMap[ar.CourtID]||{};
          const c=caseIdx[a.CaseMasterID]||{}, unit=unitMap[c.PoliceStationID]||{}, dist=distMap[unit.DistrictID]||{};
          insA.run(a.AccusedMasterID,a.CaseMasterID,c.CrimeNo||"",
            a.AccusedName,a.AgeYear,a.GenderID===1?"Male":a.GenderID===2?"Female":"Transgender",
            a.PersonID,ar.ArrestSurrenderDate||"",aDist.DistrictName||"","Karnataka",
            io.FirstName||"",ioRank.RankName||"",court.CourtName||"",
            chMap[c.CrimeMajorHeadID]||"",cshMap[c.CrimeMinorHeadID]||"",
            unit.UnitName||"",dist.DistrictName||"");
        }
      })(d.Accused);
    }

    if (countV === 0) {
      console.log("[DB] Seeding VictimSummaryFlat...");
      const insV = sqliteDb.prepare(`INSERT INTO VictimSummaryFlat VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
      sqliteDb.transaction(rows => {
        for (const v of rows) {
          const c=caseIdx[v.CaseMasterID]||{}, unit=unitMap[c.PoliceStationID]||{}, dist=distMap[unit.DistrictID]||{};
          insV.run(v.VictimMasterID,v.CaseMasterID,c.CrimeNo||"",
            v.VictimName,v.AgeYear,v.GenderID===1?"Male":"Female",v.VictimPolice||0,
            chMap[c.CrimeMajorHeadID]||"",cshMap[c.CrimeMinorHeadID]||"",
            unit.UnitName||"",dist.DistrictName||"",c.IncidentFromDate||"");
        }
      })(d.Victim);
    }

    if (countCP === 0) {
      console.log("[DB] Seeding ComplainantSummaryFlat...");
      const insCP = sqliteDb.prepare(`INSERT INTO ComplainantSummaryFlat VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      sqliteDb.transaction(rows => {
        for (const cp of rows) {
          const c=caseIdx[cp.CaseMasterID]||{}, unit=unitMap[c.PoliceStationID]||{}, dist=distMap[unit.DistrictID]||{};
          insCP.run(cp.ComplainantID,cp.CaseMasterID,c.CrimeNo||"",
            cp.ComplainantName,cp.AgeYear,cp.GenderID===1?"Male":"Female",
            occMap[cp.OccupationID]||"Others",relMap[cp.ReligionID]||"Others",cstMap[cp.CasteID]||"Others",
            chMap[c.CrimeMajorHeadID]||"",cshMap[c.CrimeMinorHeadID]||"",
            unit.UnitName||"",dist.DistrictName||"");
        }
      })(d.ComplainantDetails);
    }

    console.log("[DB] Flat database loading complete.");
  } catch (e) {
    console.warn("[DB] Seeding failed. Check seeds/seed-data.json:", e.message);
  }
}

loadSeedData();

// ─── Session sweeper — removes expired tokens every 60 seconds ───────────────

setInterval(async () => {
  try {
    const now = new Date().toISOString();
    const deletedCount = await knex("UserSessions").where("ExpiresAt", "<", now).del();
    if (deletedCount > 0) {
      console.log(`[AUTH SWEEPER] Cleaned ${deletedCount} expired session(s).`);
    }
  } catch (err) {
    console.warn("[AUTH SWEEPER ERROR]", err.message);
  }
}, 60_000);

module.exports = knex;

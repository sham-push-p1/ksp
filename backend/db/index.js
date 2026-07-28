/**
 * db/index.js — Database initialization, seeding, migrations, and session cleanup.
 * Exports the configured Knex instance for use across routes.
 */

const bcrypt = require("bcryptjs");
const knexConfig = require("../knexfile");
const env = process.env.X_ZOHO_CATALYST_LISTEN_PORT ? 'catalyst' : (process.env.DB_HOST ? 'catalyst' : (process.env.NODE_ENV || 'development'));
const knex = require("knex")(knexConfig[env]);
const logger = require("../utils/logger");

// Prevent unhandled Knex connection pool errors from crashing the process!
knex.on('error', (err) => {
  logger.error(`[DB Pool Error] ${err.message}`);
});

async function initializeDB() {
  try {
    // ─── Table Creation (Dialect Agnostic) ───────────────────────────────────
    
    if (!await knex.schema.hasTable('SystemUsers')) {
      await knex.schema.createTable('SystemUsers', t => {
        t.string('UserID').primary();
        t.string('Username').unique();
        t.string('PasswordHash');
        t.string('Role');
        t.string('Name');
        t.string('DistrictName').nullable();
        t.string('StationName').nullable();
      });
    }

    if (!await knex.schema.hasTable('KnowledgeBase')) {
      await knex.schema.createTable('KnowledgeBase', t => {
        t.increments('ID').primary(); // serial in PG, autoincrement in SQLite
        t.text('Title');
        t.text('Content');
        t.text('EmbeddingVec');
        t.string('CreatedAt');
      });
    }

    if (!await knex.schema.hasTable('UserSessions')) {
      await knex.schema.createTable('UserSessions', t => {
        t.string('Token').primary();
        t.string('UserID');
        t.string('Username');
        t.string('Role');
        t.string('Name');
        t.string('DistrictName').nullable();
        t.string('StationName').nullable();
        t.string('CreatedAt');
        t.string('ExpiresAt').nullable();
      });
    } else {
      // Migration: Add ExpiresAt if missing
      const hasExpiresAt = await knex.schema.hasColumn('UserSessions', 'ExpiresAt');
      if (!hasExpiresAt) {
        await knex.schema.alterTable('UserSessions', t => {
          t.string('ExpiresAt').nullable();
        });
        logger.info("[DB MIGRATION] Added ExpiresAt column to UserSessions.");
      }
    }

    if (!await knex.schema.hasTable('CaseSummaryFlat')) {
      await knex.schema.createTable('CaseSummaryFlat', t => {
        t.integer('CaseMasterID'); t.string('CrimeNo'); t.string('CaseNo');
        t.string('CrimeRegisteredDate'); t.string('IncidentFromDate'); t.string('IncidentToDate');
        t.float('Latitude'); t.float('Longitude'); t.text('BriefFacts');
        t.string('CaseCategoryName'); t.string('GravityOffence');
        t.string('CrimeMajorHead'); t.string('CrimeMinorHead'); t.string('CaseStatus');
        t.string('PoliceStationName'); t.string('DistrictName'); t.string('StateName');
        t.string('RegisteringOfficerName'); t.string('RegisteringOfficerRank');
        t.string('CourtName'); t.text('EmbeddingVec').nullable();
      });
    }

    if (!await knex.schema.hasTable('AccusedSummaryFlat')) {
      await knex.schema.createTable('AccusedSummaryFlat', t => {
        t.integer('AccusedMasterID'); t.integer('CaseMasterID'); t.string('CrimeNo');
        t.string('AccusedName'); t.integer('AgeYear'); t.string('Gender'); t.string('PersonID');
        t.string('ArrestDate'); t.string('ArrestDistrict'); t.string('ArrestState');
        t.string('ArrestingOfficerName'); t.string('ArrestingOfficerRank');
        t.string('ProducedInCourt'); t.string('CrimeMajorHead'); t.string('CrimeMinorHead');
        t.string('PoliceStationName'); t.string('DistrictName'); t.string('Education'); 
        t.string('Employment'); t.string('RiskScore');
      });
    }

    if (!await knex.schema.hasTable('VictimSummaryFlat')) {
      await knex.schema.createTable('VictimSummaryFlat', t => {
        t.integer('VictimMasterID'); t.integer('CaseMasterID'); t.string('CrimeNo');
        t.string('VictimName'); t.integer('AgeYear'); t.string('Gender'); t.integer('IsPoliceVictim');
        t.string('CrimeMajorHead'); t.string('CrimeMinorHead');
        t.string('PoliceStationName'); t.string('DistrictName'); t.string('IncidentFromDate');
      });
    }

    if (!await knex.schema.hasTable('ComplainantSummaryFlat')) {
      await knex.schema.createTable('ComplainantSummaryFlat', t => {
        t.integer('ComplainantID'); t.integer('CaseMasterID'); t.string('CrimeNo');
        t.string('ComplainantName'); t.integer('AgeYear'); t.string('Gender');
        t.string('Occupation'); t.string('Religion'); t.string('Caste');
        t.string('CrimeMajorHead'); t.string('CrimeMinorHead');
        t.string('PoliceStationName'); t.string('DistrictName');
      });
    }

    if (!await knex.schema.hasTable('QueryAuditLog')) {
      await knex.schema.createTable('QueryAuditLog', t => {
        t.increments('ID').primary();
        t.string('UserID'); t.string('UserRole'); t.string('SessionID');
        t.text('Question'); t.string('Intent'); t.text('GeneratedQuery');
        t.integer('ResultCount'); t.integer('LatencyMs'); t.string('Timestamp'); t.string('Status');
      });
    }

    if (!await knex.schema.hasTable('FinancialTransactionsFlat')) {
      await knex.schema.createTable('FinancialTransactionsFlat', t => {
        t.increments('TransactionID').primary();
        t.integer('AccusedMasterID');
        t.integer('CaseMasterID');
        t.string('CrimeNo');
        t.string('SenderAccount');
        t.string('ReceiverAccount');
        t.float('Amount');
        t.string('TransactionDate');
        t.integer('SuspiciousFlag');
        t.text('Remarks');
        t.string('PoliceStationName');
        t.string('DistrictName');
      });
    }

    // ─── Seed SystemUsers ────────────────────────────────────────────────────────
    
    const { count: systemUserCount } = await knex('SystemUsers').count('* as count').first();
    if (Number(systemUserCount) === 0) {
      logger.info("[DB] Seeding SystemUsers with bcrypt hashes (cost=12)...");
      const demoUsers = [
        { UserID: "EMP001", Role: "scrb_analyst", Name: "SCRB Analyst", DistrictName: null, StationName: null, Username: "admin", PasswordHash: bcrypt.hashSync("Ksp@Scrb#2025!Adm", 12) },
        { UserID: "EMP002", Role: "sp", Name: "SP Bengaluru Urban", DistrictName: "Bengaluru Urban", StationName: null, Username: "sp_blr", PasswordHash: bcrypt.hashSync("Ksp@Sp#Blr2025!", 12) },
        { UserID: "EMP003", Role: "inspector", Name: "Inspector Whitefield", DistrictName: "Bengaluru Urban", StationName: "Whitefield", Username: "insp_wf", PasswordHash: bcrypt.hashSync("Ksp@Insp#Wf2025!", 12) },
        { UserID: "EMP004", Role: "constable", Name: "Constable Sharma", DistrictName: "Bengaluru Urban", StationName: "Cubbon Park", Username: "constable", PasswordHash: bcrypt.hashSync("Ksp@Const#2025!", 12) },
      ];
      await knex('SystemUsers').insert(demoUsers);
      logger.info("[DB] SystemUsers seeded successfully with bcrypt.");
    }

    // Migrate old SHA-256 hashes to bcrypt if they exist
    const legacyUsers = await knex('SystemUsers').select('UserID', 'Username', 'PasswordHash');
    const legacyPasswords = { admin:"Ksp@Scrb#2025!Adm", sp_blr:"Ksp@Sp#Blr2025!", insp_wf:"Ksp@Insp#Wf2025!", constable:"Ksp@Const#2025!" };
    let migrated = 0;
    for (const u of legacyUsers) {
      if (!u.PasswordHash.startsWith("$2b$") && legacyPasswords[u.Username]) {
        await knex('SystemUsers').where({ UserID: u.UserID }).update({ PasswordHash: bcrypt.hashSync(legacyPasswords[u.Username], 12) });
        migrated++;
      }
    }
    if (migrated > 0) logger.info(`[DB MIGRATION] Re-hashed ${migrated} user password(s) to bcrypt.`);



    // ─── Seed flat tables from seeds/seed-data.json ──────────────────────────────
    
    const { count: countC } = await knex('CaseSummaryFlat').count('* as count').first();
    const { count: countA } = await knex('AccusedSummaryFlat').count('* as count').first();
    const { count: countV } = await knex('VictimSummaryFlat').count('* as count').first();
    const { count: countCP } = await knex('ComplainantSummaryFlat').count('* as count').first();

    if (Number(countC) > 0 && Number(countA) > 0 && Number(countV) > 0 && Number(countCP) > 0) {
      logger.info(`[DB] All flat tables loaded (${countC} cases, ${countA} accused, ${countV} victims, ${countCP} complainants)`);
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

      if (Number(countC) === 0) {
        logger.info("[DB] Seeding CaseSummaryFlat...");
        const inserts = d.CaseMaster.map(c => {
          const unit = unitMap[c.PoliceStationID]||{};
          const dist = distMap[unit.DistrictID]||{};
          const emp = empMap[c.PolicePersonID]||{};
          const rank = rankMap[emp.RankID]||{};
          const court = crtMap[c.CourtID]||{};
          return {
            CaseMasterID: c.CaseMasterID, CrimeNo: c.CrimeNo, CaseNo: c.CaseNo,
            CrimeRegisteredDate: c.CrimeRegisteredDate, IncidentFromDate: c.IncidentFromDate,
            IncidentToDate: c.IncidentToDate, Latitude: c.latitude, Longitude: c.longitude,
            BriefFacts: c.BriefFacts || "", CaseCategoryName: catMap[c.CaseCategoryID] || "FIR",
            GravityOffence: gravMap[c.GravityOffenceID] || "", CrimeMajorHead: chMap[c.CrimeMajorHeadID] || "",
            CrimeMinorHead: cshMap[c.CrimeMinorHeadID] || "", CaseStatus: stMap[c.CaseStatusID] || "",
            PoliceStationName: unit.UnitName || "", DistrictName: dist.DistrictName || "",
            StateName: "Karnataka", RegisteringOfficerName: emp.FirstName || "",
            RegisteringOfficerRank: rank.RankName || "", CourtName: court.CourtName || "",
            EmbeddingVec: null
          };
        });
        await knex.batchInsert('CaseSummaryFlat', inserts, 500);
      }

      if (Number(countA) === 0) {
        logger.info("[DB] Seeding AccusedSummaryFlat...");
        const offenderCounts = {};
        for (const a of d.Accused) offenderCounts[a.AccusedName] = (offenderCounts[a.AccusedName]||0)+1;

        const inserts = d.Accused.map(a => {
          const ar = arMap[a.AccusedMasterID]||{};
          const aDist = distMap[ar.ArrestSurrenderDistrictId]||{};
          const io = empMap[ar.IOID]||{};
          const ioRank = rankMap[io.RankID]||{};
          const court = crtMap[ar.CourtID]||{};
          const c = caseIdx[a.CaseMasterID]||{};
          const unit = unitMap[c.PoliceStationID]||{};
          const dist = distMap[unit.DistrictID]||{};
          
          const edus = ["High School", "Graduate", "Primary", "Illiterate"];
          const emps = ["Unemployed", "Self-employed", "Private Sector", "Laborer"];
          const rc = offenderCounts[a.AccusedName]||1;
          const risk = rc > 3 ? "High" : (rc > 1 ? "Medium" : "Low");

          return {
            AccusedMasterID: a.AccusedMasterID, CaseMasterID: a.CaseMasterID, CrimeNo: c.CrimeNo || "",
            AccusedName: a.AccusedName, AgeYear: a.AgeYear, Gender: a.GenderID===1?"Male":a.GenderID===2?"Female":"Transgender",
            PersonID: a.PersonID, ArrestDate: ar.ArrestSurrenderDate || "", ArrestDistrict: aDist.DistrictName || "",
            ArrestState: "Karnataka", ArrestingOfficerName: io.FirstName || "", ArrestingOfficerRank: ioRank.RankName || "",
            ProducedInCourt: court.CourtName || "", CrimeMajorHead: chMap[c.CrimeMajorHeadID] || "",
            CrimeMinorHead: cshMap[c.CrimeMinorHeadID] || "", PoliceStationName: unit.UnitName || "",
            DistrictName: dist.DistrictName || "", Education: edus[Math.floor(Math.random()*edus.length)],
            Employment: emps[Math.floor(Math.random()*emps.length)], RiskScore: risk
          };
        });
        await knex.batchInsert('AccusedSummaryFlat', inserts, 500);
      }

      if (Number(countV) === 0) {
        logger.info("[DB] Seeding VictimSummaryFlat...");
        const inserts = d.Victim.map(v => {
          const c = caseIdx[v.CaseMasterID]||{};
          const unit = unitMap[c.PoliceStationID]||{};
          const dist = distMap[unit.DistrictID]||{};
          return {
            VictimMasterID: v.VictimMasterID, CaseMasterID: v.CaseMasterID, CrimeNo: c.CrimeNo || "",
            VictimName: v.VictimName, AgeYear: v.AgeYear, Gender: v.GenderID===1?"Male":"Female",
            IsPoliceVictim: v.VictimPolice||0, CrimeMajorHead: chMap[c.CrimeMajorHeadID] || "",
            CrimeMinorHead: cshMap[c.CrimeMinorHeadID] || "", PoliceStationName: unit.UnitName || "",
            DistrictName: dist.DistrictName || "", IncidentFromDate: c.IncidentFromDate || ""
          };
        });
        await knex.batchInsert('VictimSummaryFlat', inserts, 500);
      }

      if (Number(countCP) === 0) {
        logger.info("[DB] Seeding ComplainantSummaryFlat...");
        const inserts = d.ComplainantDetails.map(cp => {
          const c = caseIdx[cp.CaseMasterID]||{};
          const unit = unitMap[c.PoliceStationID]||{};
          const dist = distMap[unit.DistrictID]||{};
          return {
            ComplainantID: cp.ComplainantID, CaseMasterID: cp.CaseMasterID, CrimeNo: c.CrimeNo || "",
            ComplainantName: cp.ComplainantName, AgeYear: cp.AgeYear, Gender: cp.GenderID===1?"Male":"Female",
            Occupation: occMap[cp.OccupationID]||"Others", Religion: relMap[cp.ReligionID]||"Others", Caste: cstMap[cp.CasteID]||"Others",
            CrimeMajorHead: chMap[c.CrimeMajorHeadID] || "", CrimeMinorHead: cshMap[c.CrimeMinorHeadID] || "",
            PoliceStationName: unit.UnitName || "", DistrictName: dist.DistrictName || ""
          };
        });
        await knex.batchInsert('ComplainantSummaryFlat', inserts, 500);
      }

      const { count: countF } = await knex('FinancialTransactionsFlat').count('* as count').first();
      if (Number(countF) === 0) {
        logger.info("[DB] Seeding synthetic FinancialTransactionsFlat...");
        let inserts = [];
        let i = 0;
        for (const a of d.Accused) {
          if (i++ > 150) break;
          const c = caseIdx[a.CaseMasterID] || {};
          const unit = unitMap[c.PoliceStationID] || {};
          const dist = distMap[unit.DistrictID] || {};
          const isSuspicious = a.AgeYear > 25 && a.AgeYear < 45 ? 1 : 0;
          const amt = Math.floor(Math.random() * 500000) + 10000;
          inserts.push({
            AccusedMasterID: a.AccusedMasterID, CaseMasterID: a.CaseMasterID, CrimeNo: c.CrimeNo || "",
            SenderAccount: 'ACC-' + Math.floor(Math.random() * 9999999), ReceiverAccount: 'ACC-' + Math.floor(Math.random() * 9999999),
            Amount: amt, TransactionDate: c.IncidentFromDate || "2024-01-01", SuspiciousFlag: isSuspicious,
            Remarks: isSuspicious ? "Flagged: High Value / Money Trail" : "Regular Transaction",
            PoliceStationName: unit.UnitName || "", DistrictName: dist.DistrictName || ""
          });
        }
        await knex.batchInsert('FinancialTransactionsFlat', inserts, 500);
      }

      logger.info("[DB] Flat database loading complete.");
    } catch (e) {
      logger.error(`[DB] Seeding failed. Check seeds/seed-data.json: ${e.message}`);
    }
  } catch (e) {
    logger.error(`[DB] Initialization error: ${e.message}`);
  }
}

// Initialize on startup
initializeDB();

// ─── Session sweeper — removes expired tokens every 60 seconds ───────────────
setInterval(async () => {
  try {
    const now = new Date().toISOString();
    const deletedCount = await knex("UserSessions").where("ExpiresAt", "<", now).del();
    if (deletedCount > 0) {
      logger.info(`[AUTH SWEEPER] Cleaned ${deletedCount} expired session(s).`);
    }
  } catch (err) {
    logger.error(`[DB] Session cleanup failed: ${err.message}`);
  }
}, 60_000);

// Fallback for login if DB fails
async function fallbackLogin(username) {
  if (["admin", "sp_blr", "insp_wf", "constable"].includes(username)) {
    return {
      id: 999,
      username,
      role: username === 'admin' ? 'SCRB Analyst' : username.toUpperCase(),
      department: 'Demo Data',
      district: 'Bengaluru'
    };
  }
  return null;
}

knex.initializeDB = initializeDB;
knex.verifyPassword = async (p, h) => bcrypt.compare(p, h);
knex.hashPassword = async (p) => bcrypt.hash(p, 12);
knex.fallbackLogin = fallbackLogin;
knex.knex = knex;

module.exports = knex;

const FLAT_TABLE_SCHEMA = {
  CaseSummaryFlat: [
    "CaseMasterID","CrimeNo","CaseNo","CrimeRegisteredDate","IncidentFromDate",
    "IncidentToDate","Latitude","Longitude","BriefFacts","CaseCategoryName",
    "GravityOffence","CrimeMajorHead","CrimeMinorHead","CaseStatus",
    "PoliceStationName","DistrictName","StateName","RegisteringOfficerName",
    "RegisteringOfficerRank","CourtName",
  ],
  AccusedSummaryFlat: [
    "AccusedMasterID","CaseMasterID","CrimeNo","AccusedName","AgeYear","Gender",
    "PersonID","ArrestDate","ArrestDistrict","ArrestState","ArrestingOfficerName",
    "ArrestingOfficerRank","ProducedInCourt","CrimeMajorHead","CrimeMinorHead",
    "PoliceStationName","DistrictName","Education","Employment","RiskScore"
  ],
  VictimSummaryFlat: [
    "VictimMasterID","CaseMasterID","CrimeNo","VictimName","AgeYear","Gender",
    "IsPoliceVictim","CrimeMajorHead","CrimeMinorHead","PoliceStationName",
    "DistrictName","IncidentFromDate",
  ],
  FinancialTransactionsFlat: [
    "TransactionID", "AccusedMasterID", "CaseMasterID", "CrimeNo",
    "SenderAccount", "ReceiverAccount", "Amount", "TransactionDate",
    "SuspiciousFlag", "Remarks", "PoliceStationName", "DistrictName"
  ]
};

const RBAC = {
  constable:    { stationScoped: true,  districtScoped: false },
  inspector:    { stationScoped: false, districtScoped: true  },
  dsp:          { stationScoped: false, districtScoped: false },
  sp:           { stationScoped: false, districtScoped: false },
  scrb_analyst: { stationScoped: false, districtScoped: false, allKarnataka: true },
};

const INTENTS = {
  GENERAL:          "general",
  STRUCTURED_QUERY: "structured_query",
  NARRATIVE_SEARCH: "narrative_search",
  HYBRID:           "hybrid",
  TREND_ANALYSIS:   "trend_analysis",
  NETWORK_ANALYSIS: "network_analysis",
  PREDICTIVE:       "predictive",
  UNKNOWN:          "unknown",
};

module.exports = { FLAT_TABLE_SCHEMA, RBAC, INTENTS };

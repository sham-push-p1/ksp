const fs = require("fs");

const DISTRICTS = [
  {id:1,name:"Bengaluru Urban"},{id:2,name:"Bengaluru Rural"},{id:3,name:"Mysuru"},
  {id:4,name:"Mangaluru"},{id:5,name:"Hubballi-Dharwad"},{id:6,name:"Belagavi"},
  {id:7,name:"Kalaburagi"},{id:8,name:"Shivamogga"},{id:9,name:"Tumakuru"},{id:10,name:"Vijayapura"},
];
const STATIONS = {
  1:["Cubbon Park","Shivajinagar","Whitefield","Electronic City","Yeshwanthpur","Hebbal"],
  2:["Ramanagara","Channapatna","Magadi","Nelamangala"],
  3:["Mysuru North","Mysuru South","Nanjangud","Hunsur"],
  4:["Mangaluru East","Mangaluru West","Udupi","Manipal"],
  5:["Hubballi Town","Dharwad","Kalghatgi"],
  6:["Belagavi Town","Chikodi","Gokak"],
  7:["Kalaburagi Town","Yadgir","Surpur"],
  8:["Shimoga Town","Bhadravati","Sagar"],
  9:["Tumakuru Town","Tiptur","Pavagada"],
  10:["Vijayapura Town","Indi","Muddebihal"],
};
const CRIME_HEADS = [
  {id:1,major:"Crimes Against Body",minors:[
    {id:1,name:"Murder",sections:["IPC-302"],gravity:"Heinous"},
    {id:2,name:"Attempt to Murder",sections:["IPC-307"],gravity:"Heinous"},
    {id:3,name:"Culpable Homicide",sections:["IPC-304"],gravity:"Heinous"},
    {id:4,name:"Hurt/Grievous Hurt",sections:["IPC-324"],gravity:"Non-Heinous"},
    {id:5,name:"Assault on Woman",sections:["IPC-354"],gravity:"Non-Heinous"},
  ]},
  {id:2,major:"Crimes Against Property",minors:[
    {id:6,name:"Robbery",sections:["IPC-392"],gravity:"Heinous"},
    {id:7,name:"Burglary",sections:["IPC-457"],gravity:"Non-Heinous"},
    {id:8,name:"Theft",sections:["IPC-379"],gravity:"Non-Heinous"},
    {id:9,name:"Cheating",sections:["IPC-420"],gravity:"Non-Heinous"},
    {id:10,name:"Extortion",sections:["IPC-383"],gravity:"Non-Heinous"},
  ]},
  {id:3,major:"Crimes Against Women",minors:[
    {id:11,name:"Rape",sections:["IPC-376"],gravity:"Heinous"},
    {id:12,name:"Kidnapping of Women",sections:["IPC-366"],gravity:"Heinous"},
    {id:13,name:"Dowry Death",sections:["IPC-304B"],gravity:"Heinous"},
    {id:14,name:"Molestation",sections:["IPC-354A"],gravity:"Non-Heinous"},
    {id:15,name:"Harassment",sections:["IPC-498A"],gravity:"Non-Heinous"},
  ]},
  {id:4,major:"Economic Offences",minors:[
    {id:16,name:"Fraud",sections:["IPC-420"],gravity:"Non-Heinous"},
    {id:17,name:"Forgery",sections:["IPC-465"],gravity:"Non-Heinous"},
    {id:18,name:"Cyber Crime",sections:["IT-66C"],gravity:"Non-Heinous"},
  ]},
  {id:5,major:"Special & Local Laws",minors:[
    {id:19,name:"NDPS Act",sections:["NDPS-20"],gravity:"Heinous"},
    {id:20,name:"Arms Act",sections:["Arms-25"],gravity:"Non-Heinous"},
    {id:21,name:"Excise Act",sections:["Excise-32"],gravity:"Non-Heinous"},
  ]},
];
const STATUSES=["Under Investigation","Charge Sheeted","Closed - True","Closed - False","Undetected","Pending in Court"];
const RANKS=["Constable","Head Constable","ASI","SI","PSI","PI","DySP","SP"];
const RELIGIONS=["Hindu","Muslim","Christian","Jain","Buddhist","Sikh","Others"];
const CASTES=["General","OBC","SC","ST","Others"];
const OCCUPATIONS=["Farmer","Government Employee","Private Employee","Business","Student","Daily Wage Labour","Unemployed","Others"];
const COURTS=["JMFC Court","Sessions Court","High Court","CBI Court","Special NDPS Court"];
const ACC_NAMES=["Ravi Kumar","Mohammed Imran","Suresh Naik","Prakash Gowda","Venkatesh B","Ramesh Reddy","Ajay Singh","Krishna Murthy","Syed Farhan","Manjunath K","Deepak Nair","Arjun Shetty","Santosh Patil","Basavaraju N","Shiva Kumar","Anand Raj","Nagesh T","Harish B G","Vijay Kumar","Mohammed Riyaz"];
const VIC_NAMES=["Latha S","Priya K","Meena Devi","Kavitha N","Rekha B","Anitha R","Suma G","Nirmala K","Usha M","Divya T","Srinivas B","Rajesh K","Mohan Das","Ashok Kumar","Balu S"];
const COMP_NAMES=["Basappa G","Nagaraju T","Siddappa K","Rangaswamy B","Yellappa N","Thimmaiah K","Puttaswamy G","Narasimhaiah M","Krishnappa R","Venkataramaiah B"];
const LOCS=["near the bus stand","in front of the house","on the main road","near the market","in the agricultural field","on the highway","near the school","in the residential area"];
const DESCS={"Murder":"attacked and killed the victim with a sharp weapon","Attempt to Murder":"attacked the victim with intent to kill causing grievous injuries","Robbery":"robbed the complainant at knife-point and fled with valuables","Burglary":"broke into the premises and committed theft","Theft":"stole the complainant vehicle without knowledge","Cheating":"cheated the complainant of money under false pretences","Rape":"sexually assaulted the victim","NDPS Act":"was found in possession of contraband narcotic substance","Hurt/Grievous Hurt":"assaulted and caused grievous hurt to the victim","Harassment":"harassed the victim causing mental distress","Fraud":"committed fraud by forging documents","Forgery":"forged official documents to gain financial advantage","Cyber Crime":"hacked bank account and transferred funds illegally","Kidnapping of Women":"abducted the victim against her will","Dowry Death":"harassed victim over dowry demands","Molestation":"molested victim in a public place","Extortion":"extorted money through threats","Arms Act":"was found in possession of illegal firearms","Excise Act":"was found in possession of illicit liquor","Assault on Woman":"outraged the modesty of victim woman","Culpable Homicide":"caused death of victim without premeditation"};

function rand(a){return a[Math.floor(Math.random()*a.length)];}
function ri(n,x){return Math.floor(Math.random()*(x-n+1))+n;}
function rDate(s,e){return new Date(s.getTime()+Math.random()*(e.getTime()-s.getTime()));}
function fmt(d){return d.toISOString().split("T")[0];}
function fmtDT(d){return d.toISOString().replace("T"," ").split(".")[0];}

function generate(count=1000){
  let unitId=1;
  const unitMap={},units=[],employees=[];
  DISTRICTS.forEach(d=>{
    unitMap[d.id]=[];
    (STATIONS[d.id]||[]).forEach(n=>{units.push({UnitID:unitId,UnitName:n,DistrictID:d.id,StateID:1});unitMap[d.id].push({id:unitId,name:n});unitId++;});
  });
  for(let i=1;i<=80;i++){const did=ri(1,10);const u=rand(unitMap[did]);employees.push({EmployeeID:i,FirstName:`Officer_${i}`,RankID:ri(1,6),UnitID:u.id,DistrictID:did,KGID:`KA${String(i).padStart(6,"0")}`});}

  const CM=[],CP=[],V=[],A=[],AR=[],CS=[];
  const s=new Date("2020-01-01"),e=new Date("2025-12-31");
  for(let i=0;i<count;i++){
    const did=ri(1,10);const dist=DISTRICTS[did-1];const u=rand(unitMap[did]);const emp=rand(employees);
    const ch=rand(CRIME_HEADS);const cm=rand(ch.minors);
    const iDate=rDate(s,e);const rDate2=new Date(iDate.getTime()+ri(0,3)*86400000);
    const stName=rand(STATUSES);const stId=STATUSES.indexOf(stName)+1;
    const yr=rDate2.getFullYear();const ser=String(i+1).padStart(5,"0");
    const crimeNo=`1${String(did).padStart(4,"0")}${String(u.id).padStart(4,"0")}${yr}${ser}`;
    const lat=(11.5+Math.random()*4.5).toFixed(6);const lng=(74.0+Math.random()*4.5).toFixed(6);
    const cName=rand(COMP_NAMES);const aName=rand(ACC_NAMES);const vName=rand(VIC_NAMES);const loc=rand(LOCS);
    const desc=DESCS[cm.name]||"committed an offence";
    const bf=`The complainant ${cName} reports that on ${fmt(iDate)}, accused ${aName} ${desc} ${loc}. The complainant has identified the accused and requests immediate action.`;
    CM.push({CaseMasterID:i+1,CrimeNo:crimeNo,CaseNo:`${yr}${ser}`,CrimeRegisteredDate:fmt(rDate2),PolicePersonID:emp.EmployeeID,PoliceStationID:u.id,CaseCategoryID:1,GravityOffenceID:cm.gravity==="Heinous"?1:2,CrimeMajorHeadID:ch.id,CrimeMinorHeadID:cm.id,CaseStatusID:stId,CourtID:ri(1,5),IncidentFromDate:fmtDT(iDate),IncidentToDate:fmtDT(new Date(iDate.getTime()+3600000*ri(1,4))),latitude:parseFloat(lat),longitude:parseFloat(lng),BriefFacts:bf});
    CP.push({ComplainantID:i+1,CaseMasterID:i+1,ComplainantName:cName,AgeYear:ri(18,70),OccupationID:ri(1,8),ReligionID:ri(1,7),CasteID:ri(1,5),GenderID:ri(1,2)});
    if(Math.random()>0.3)V.push({VictimMasterID:V.length+1,CaseMasterID:i+1,VictimName:vName,AgeYear:ri(5,75),GenderID:ri(1,2),VictimPolice:Math.random()<0.05?1:0});
    const na=ri(1,3);
    for(let a=0;a<na;a++)A.push({AccusedMasterID:A.length+1,CaseMasterID:i+1,AccusedName:rand(ACC_NAMES),AgeYear:ri(16,60),GenderID:Math.random()<0.85?1:2,PersonID:`A${a+1}`});
    if(["Charge Sheeted","Closed - True","Pending in Court"].includes(stName))AR.push({ArrestSurrenderID:AR.length+1,CaseMasterID:i+1,ArrestSurrenderDate:fmt(new Date(rDate2.getTime()+ri(1,30)*86400000)),ArrestSurrenderDistrictId:did,IOID:emp.EmployeeID,CourtID:ri(1,5),AccusedMasterID:A.length,IsAccused:1,IsComplainantAccused:0});
    if(stName==="Charge Sheeted")CS.push({CSID:CS.length+1,CaseMasterID:i+1,csdate:fmtDT(new Date(rDate2.getTime()+60*86400000)),cstype:"A",PolicePersonID:emp.EmployeeID});
  }

  const data={
    State:[{StateID:1,StateName:"Karnataka",Active:1}],
    District:DISTRICTS.map(d=>({DistrictID:d.id,DistrictName:d.name,StateID:1,Active:1})),
    Unit:units,Employee:employees,
    Rank:RANKS.map((r,i)=>({RankID:i+1,RankName:r,Hierarchy:i+1,Active:1})),
    Court:COURTS.map((c,i)=>({CourtID:i+1,CourtName:c,DistrictID:(i%10)+1,StateID:1,Active:1})),
    CaseCategory:[{CaseCategoryID:1,LookupValue:"FIR"},{CaseCategoryID:2,LookupValue:"UDR"},{CaseCategoryID:3,LookupValue:"PAR"}],
    GravityOffence:[{GravityOffenceID:1,LookupValue:"Heinous"},{GravityOffenceID:2,LookupValue:"Non-Heinous"}],
    CrimeHead:CRIME_HEADS.map(c=>({CrimeHeadID:c.id,CrimeGroupName:c.major,Active:1})),
    CrimeSubHead:CRIME_HEADS.flatMap(c=>c.minors.map(m=>({CrimeSubHeadID:m.id,CrimeHeadID:c.id,CrimeHeadName:m.name,SeqID:m.id}))),
    CaseStatusMaster:STATUSES.map((s,i)=>({CaseStatusID:i+1,CaseStatusName:s})),
    ReligionMaster:RELIGIONS.map((r,i)=>({ReligionID:i+1,ReligionName:r})),
    CasteMaster:CASTES.map((c,i)=>({caste_master_id:i+1,caste_master_name:c})),
    OccupationMaster:OCCUPATIONS.map((o,i)=>({OccupationID:i+1,OccupationName:o})),
    CaseMaster:CM,ComplainantDetails:CP,Victim:V,Accused:A,ArrestSurrender:AR,ChargesheetDetails:CS,
  };
  fs.writeFileSync("seed-data.json",JSON.stringify(data,null,2));
  console.log("Seed data generated: seed-data.json");
  Object.keys(data).forEach(k=>console.log(`  ${k}: ${data[k].length}`));
}
generate(1000);

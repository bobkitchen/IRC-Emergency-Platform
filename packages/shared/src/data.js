/**
 * @irc/shared — Classification data: stance matrix, countries, thresholds, metric configs.
 *
 * Single source of truth — used by Classification, Navigator, and CRF Calculator.
 */

// STANCE_MATRIX — severity × population vulnerability × response capacity → stance color
export const STANCE_MATRIX = {"1":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"4":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"}},"2":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"4":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"}},"3":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"4":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"}},"4":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"4":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"}},"5":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"4":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"}},"6":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"orange","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"orange","1":"orange","2":"orange","3":"orange","4":"yellow","5":"yellow"},"4":{"0":"orange","1":"orange","2":"orange","3":"orange","4":"orange","5":"orange"}},"7":{"1":{"0":"white","1":"yellow","2":"yellow","3":"yellow","4":"yellow","5":"yellow"},"2":{"0":"orange","1":"orange","2":"orange","3":"yellow","4":"yellow","5":"yellow"},"3":{"0":"orange","1":"orange","2":"orange","3":"orange","4":"orange","5":"yellow"},"4":{"0":"orange","1":"orange","2":"orange","3":"orange","4":"orange","5":"orange"}},"8":{"1":{"0":"orange","1":"orange","2":"orange","3":"orange","4":"yellow","5":"yellow"},"2":{"0":"orange","1":"orange","2":"orange","3":"orange","4":"yellow","5":"yellow"},"3":{"0":"red","1":"red","2":"red","3":"orange","4":"orange","5":"orange"},"4":{"0":"red","1":"red","2":"red","3":"red","4":"orange","5":"orange"}},"9":{"1":{"0":"red","1":"red","2":"red","3":"orange","4":"orange","5":"orange"},"2":{"0":"red","1":"red","2":"red","3":"red","4":"orange","5":"orange"},"3":{"0":"red","1":"red","2":"red","3":"red","4":"red","5":"orange"},"4":{"0":"red","1":"red","2":"red","3":"red","4":"red","5":"red"}},"10":{"1":{"0":"red","1":"red","2":"red","3":"red","4":"red","5":"orange"},"2":{"0":"red","1":"red","2":"red","3":"red","4":"red","5":"red"},"3":{"0":"red","1":"red","2":"red","3":"red","4":"red","5":"red"},"4":{"0":"red","1":"red","2":"red","3":"red","4":"red","5":"red"}}};

// COUNTRIES — [name, population, populationVulnerability, responseOperationalBurden]
export const COUNTRIES = [["Afghanistan",42647492,4,5],["Albania",2377128,2,0],["Algeria",46814308,3,0],["Angola",37885849,4,0],["Antigua and Barbuda",93772,2,0],["Argentina",45696159,2,0],["Armenia",3033500,2,0],["Australia",27196812,1,0],["Austria",9177982,1,0],["Azerbaijan",10202830,2,0],["Bahamas",401283,1,0],["Bahrain",1588670,1,0],["Bangladesh",173562364,3,3],["Barbados",282467,2,0],["Belarus",9132629,2,0],["Belgium",11858610,1,0],["Belize",417072,3,0],["Benin",14462724,4,0],["Bhutan",791524,3,0],["Bolivia (Plurinational State of)",12388571,3,0],["Bosnia and Herzegovina",3180740,2,0],["Botswana",2675352,2,0],["Brazil",216422446,2,0],["Brunei Darussalam",452524,1,0],["Bulgaria",6687717,2,0],["Burkina Faso",23251736,4,2],["Burundi",13238559,4,2],["Cabo Verde",598682,2,0],["Cambodia",17638592,3,0],["Cameroon",28647293,4,3],["Central African Republic",5742315,4,3],["Chad",18278568,4,4],["Chile",19764771,1,0],["China",1425178782,2,0],["Colombia",52085168,2,3],["Comoros",852075,3,0],["Congo",6106869,3,0],["Costa Rica",5212173,2,0],["Croatia",3850894,1,0],["Cuba",11194449,2,0],["Cyprus",1358476,1,0],["Czech Republic",10827529,1,1],["Côte d'Ivoire",28873034,4,4],["Democratic People's Republic of Korea",26160821,3,0],["Democratic Republic of the Congo",102262808,4,3],["Denmark",5910913,1,0],["Djibouti",1120849,3,0],["Dominican Republic",11228370,2,0],["Ecuador",18135463,2,3],["Egypt",112716598,3,0],["El Salvador",6364943,2,2],["Equatorial Guinea",1714671,3,0],["Eritrea",3748901,4,0],["Estonia",1373101,1,0],["Eswatini",1201670,3,0],["Ethiopia",126527060,4,5],["Fiji",936375,2,0],["Finland",5617310,1,0],["France",64756584,1,0],["Gabon",2436566,2,0],["Gambia",2773168,3,0],["Georgia",3728282,2,0],["Germany",84482267,1,2],["Ghana",34121985,3,0],["Greece",10341277,1,2],["Guatemala",18092026,3,2],["Guinea",14190612,4,0],["Guinea-Bissau",2150842,4,0],["Guyana",813834,2,0],["Haiti",11724763,4,1],["Honduras",10593798,3,2],["Hungary",10156239,1,1],["Iceland",393396,1,0],["India",1428627663,3,0],["Indonesia",277534122,3,0],["Iran (Islamic Republic of)",89172767,3,0],["Iraq",45504560,3,3],["Ireland",5255017,1,0],["Israel",9174520,1,0],["Italy",58761146,1,2],["Jamaica",2825544,2,0],["Japan",123294513,1,0],["Jordan",11337052,2,4],["Kazakhstan",19606633,2,0],["Kenya",55100586,3,5],["Kiribati",131232,2,0],["Kuwait",4310108,1,0],["Kyrgyzstan",6974998,2,0],["Lao People's Democratic Republic",7529475,3,0],["Latvia",1830211,1,0],["Lebanon",5489739,2,4],["Lesotho",2330318,3,0],["Liberia",5418377,4,2],["Libya",6888388,2,2],["Lithuania",2718352,1,0],["Luxembourg",660809,1,0],["Madagascar",30325732,4,0],["Malawi",20931751,4,0],["Malaysia",34308525,2,1],["Maldives",521457,2,0],["Mali",23293698,4,4],["Malta",535064,1,0],["Marshall Islands",41996,2,0],["Mauritania",4862989,4,0],["Mauritius",1300557,2,0],["Mexico",128455567,2,2],["Micronesia (Federated States of)",114164,2,0],["Moldova (Republic of)",3435931,2,0],["Mongolia",3447157,2,0],["Montenegro",626485,2,0],["Morocco",37840044,3,0],["Mozambique",33897354,4,0],["Myanmar",54577997,3,5],["Namibia",2604172,3,0],["Nauru",12780,2,0],["Nepal",30896590,3,0],["Netherlands",17879327,1,0],["New Zealand",5228100,1,0],["Nicaragua",7046310,3,0],["Niger",27202843,4,4],["Nigeria",223804632,4,5],["North Macedonia",2093599,2,0],["Norway",5474360,1,0],["Oman",4644384,1,0],["Pakistan",240485658,4,5],["Palau",18055,1,0],["Panama",4408581,2,0],["Papua New Guinea",10329931,3,0],["Paraguay",6861524,2,0],["Peru",34352719,2,3],["Philippines",117337368,3,1],["Poland",41026067,1,1],["Portugal",10247605,1,0],["Qatar",2716391,1,0],["Romania",19892812,2,1],["Russian Federation",144236933,2,0],["Rwanda",14094683,3,0],["Saint Lucia",180251,2,0],["Saint Vincent and the Grenadines",103698,2,0],["Samoa",225681,2,0],["Sao Tome and Principe",231856,3,0],["Saudi Arabia",36947025,1,0],["Senegal",17763163,3,0],["Serbia",7149077,2,2],["Sierra Leone",8791092,4,2],["Singapore",6014723,1,0],["Slovakia",5795199,1,1],["Slovenia",2119675,1,0],["Solomon Islands",740424,3,0],["Somalia",18143378,4,4],["South Africa",60414495,3,0],["South Sudan",11088796,4,5],["Spain",47519628,1,0],["Sri Lanka",21893579,2,0],["State of Palestine",5371230,4,1],["Sudan",48109006,4,3],["Suriname",623236,2,0],["Sweden",10612086,1,0],["Switzerland",8796669,1,0],["Syrian Arab Republic",24672760,3,4],["Tajikistan",10143543,3,0],["Thailand",71801279,2,3],["Timor-Leste",1360596,3,0],["Togo",9053799,4,0],["Tonga",107773,2,0],["Trinidad and Tobago",1534937,2,0],["Tunisia",12458223,2,1],["Turkey",85816199,2,1],["Turkmenistan",6516100,3,0],["Tuvalu",11312,2,0],["Uganda",48582334,4,5],["Ukraine",37000000,2,3],["United Arab Emirates",9441129,1,0],["United Kingdom",67736802,1,0],["United Republic of Tanzania",67438106,4,4],["United States of America",339996563,1,0],["Uruguay",3423108,1,0],["Uzbekistan",35163944,2,0],["Vanuatu",326740,2,0],["Venezuela (Bolivarian Republic of)",28838499,3,3],["Viet Nam",98858950,2,0],["Yemen",34449825,4,2],["Zambia",20569737,3,0],["Zimbabwe",16665409,3,2]];

// THRESHOLDS — severity threshold configurations by crisis type
export const THRESHOLDS = {
  conflict: {
    deaths: [[10,1],[100,2],[500,3],[2500,4],[10000,5]],
    injuries: [[50,1],[500,2],[2500,3],[10000,4],[50000,5]],
    displaced: [[10000,1],[100000,2],[500000,3],[1500000,4],[3000000,5]],
    affected: [[23000,1],[160000,2],[550000,3],[1800000,4],[4000000,5]],
    proportion: [[0.0009,1],[0.0021,2],[0.0131,3],[0.078,4],[0.2,5]]
  },
  outbreak: {
    total_affected: [[80,1],[1200,2],[4500,3],[20000,4],[180000,5]],
    confirmed: [[45,1],[650,2],[2000,3],[9500,4],[100000,5]],
    deaths: [[1,1],[70,2],[250,3],[1000,4],[3500,5]],
    proportion: [[0.0004,1],[0.0053,2],[0.0367,3],[0.1216,4],[1.5,5]]
  },
  food: {
    ipc4: [[100,1],[3000,2],[34333,3],[100000,4],[280000,5]],
    ipc_prop: [[0.00001,1],[0.0001,2],[0.0017,3],[0.0061,4],[0.015,5]],
    erd: [[100,1],[3364,2],[22829,3],[58099,4],[122267,5]],
    erd_pct: [[0.01,1],[0.03,2],[0.05,3],[0.1,4],[0.18,5]]
  },
  hazard: {
    displaced: [[10,1],[100,2],[20000,3],[80000,4],[150000,5]],
    dead: [[10,1],[100,2],[500,3],[900,4],[1700,5]],
    injured: [[10,1],[100,2],[1200,3],[3000,4],[5200,5]],
    ptsd: [[50,1],[500,2],[88000,3],[160000,4],[330000,5]]
  }
};

// METRIC_CONFIGS — form field configurations for each crisis type
export const METRIC_CONFIGS = {
  conflict: [
    {id: 'deaths', label: 'Deaths', hint: 'Total number of deaths'},
    {id: 'injuries', label: 'Injuries', hint: 'Total number of injuries'},
    {id: 'displaced', label: 'Internally Displaced Persons (IDPs)', hint: 'Number of people displaced from home'},
    {id: 'affected', label: 'Total Affected Population', hint: 'Total affected population in area'},
    {id: 'proportion', label: 'Proportion of Population Affected', hint: 'Affected as % of total population (0-1)'}
  ],
  outbreak: [
    {id: 'total_affected', label: 'Total Affected', hint: 'Total affected population'},
    {id: 'confirmed', label: 'Confirmed Cases', hint: 'Confirmed disease cases'},
    {id: 'deaths', label: 'Deaths', hint: 'Total deaths from disease'},
    {id: 'proportion', label: 'Proportion Affected', hint: 'Affected as % of total population (0-1)'}
  ],
  food: [
    {id: 'ipc4', label: 'IPC Phase 4 Population', hint: 'Number in IPC Phase 4'},
    {id: 'ipc_prop', label: 'Proportion in IPC Phase 4', hint: 'IPC 4 as % of total population (0-1)'},
    {id: 'erd', label: 'Emergency Relief Deficit (ERD)', hint: 'ERD number'},
    {id: 'erd_pct', label: 'ERD Percentage', hint: 'ERD as % (0-1)'}
  ],
  hazard: [
    {id: 'displaced', label: 'Displaced from Home', hint: 'People displaced by hazard'},
    {id: 'dead', label: 'Dead or Missing', hint: 'Total dead or missing'},
    {id: 'injured', label: 'Injured', hint: 'Total injured'},
    {id: 'ptsd', label: 'PTSD Cases', hint: 'Estimated PTSD cases'}
  ]
};

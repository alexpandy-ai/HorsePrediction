export interface CoursePlace {
  region: string;
  timezone: string;
  countryCode: string;
}

function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(racecourse|race course)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function put(table: Record<string, CoursePlace>, names: string[], region: string, timezone: string, countryCode: string) {
  for (const name of names) {
    table[`${countryCode}|${key(name)}`] = { region, timezone, countryCode };
  }
}

const places: Record<string, CoursePlace> = {};

put(places, ["Ascot"], "Berkshire", "Europe/London", "GB");
put(places, ["Newmarket", "July Course", "Rowley Mile"], "Suffolk", "Europe/London", "GB");
put(places, ["Newbury"], "Berkshire", "Europe/London", "GB");
put(places, ["Windsor"], "Berkshire", "Europe/London", "GB");
put(places, ["Cheltenham"], "Gloucestershire", "Europe/London", "GB");
put(places, ["Epsom", "Epsom Downs"], "Surrey", "Europe/London", "GB");
put(places, ["Sandown", "Sandown Park", "Kempton", "Kempton Park", "Lingfield", "Lingfield Park"], "Surrey", "Europe/London", "GB");
put(places, ["York", "Catterick", "Catterick Bridge", "Redcar", "Ripon", "Thirsk"], "North Yorkshire", "Europe/London", "GB");
put(places, ["Goodwood"], "West Sussex", "Europe/London", "GB");
put(places, ["Doncaster"], "South Yorkshire", "Europe/London", "GB");
put(places, ["Brighton"], "East Sussex", "Europe/London", "GB");
put(places, ["Plumpton"], "East Sussex", "Europe/London", "GB");
put(places, ["Fontwell", "Fontwell Park"], "West Sussex", "Europe/London", "GB");
put(places, ["Chepstow"], "Monmouthshire", "Europe/London", "GB");
put(places, ["Ffos Las"], "Carmarthenshire", "Europe/London", "GB");
put(places, ["Bangor", "Bangor-on-Dee", "Bangor On Dee"], "Wrexham", "Europe/London", "GB");
put(places, ["Ayr"], "South Ayrshire", "Europe/London", "GB");
put(places, ["Hamilton", "Hamilton Park"], "South Lanarkshire", "Europe/London", "GB");
put(places, ["Musselburgh"], "East Lothian", "Europe/London", "GB");
put(places, ["Perth"], "Perth and Kinross", "Europe/London", "GB");
put(places, ["Kelso"], "Scottish Borders", "Europe/London", "GB");
put(places, ["Haydock", "Haydock Park", "Aintree"], "Merseyside", "Europe/London", "GB");
put(places, ["Chester"], "Cheshire", "Europe/London", "GB");
put(places, ["Cartmel", "Carlisle"], "Cumbria", "Europe/London", "GB");
put(places, ["Beverley"], "East Riding of Yorkshire", "Europe/London", "GB");
put(places, ["Pontefract", "Wetherby"], "West Yorkshire", "Europe/London", "GB");
put(places, ["Nottingham", "Southwell"], "Nottinghamshire", "Europe/London", "GB");
put(places, ["Leicester"], "Leicestershire", "Europe/London", "GB");
put(places, ["Huntingdon"], "Cambridgeshire", "Europe/London", "GB");
put(places, ["Fakenham", "Yarmouth", "Great Yarmouth"], "Norfolk", "Europe/London", "GB");
put(places, ["Wolverhampton", "Dunstall Park"], "West Midlands", "Europe/London", "GB");
put(places, ["Uttoxeter"], "Staffordshire", "Europe/London", "GB");
put(places, ["Ludlow"], "Shropshire", "Europe/London", "GB");
put(places, ["Hereford"], "Herefordshire", "Europe/London", "GB");
put(places, ["Worcester"], "Worcestershire", "Europe/London", "GB");
put(places, ["Stratford", "Stratford-on-Avon", "Warwick"], "Warwickshire", "Europe/London", "GB");
put(places, ["Towcester"], "Northamptonshire", "Europe/London", "GB");
put(places, ["Market Rasen"], "Lincolnshire", "Europe/London", "GB");
put(places, ["Newcastle", "Newcastle Gosforth"], "Tyne and Wear", "Europe/London", "GB");
put(places, ["Hexham"], "Northumberland", "Europe/London", "GB");
put(places, ["Sedgefield"], "County Durham", "Europe/London", "GB");
put(places, ["Exeter", "Newton Abbot"], "Devon", "Europe/London", "GB");
put(places, ["Taunton", "Wincanton", "Bath"], "Somerset", "Europe/London", "GB");
put(places, ["Salisbury"], "Wiltshire", "Europe/London", "GB");
put(places, ["Chelmsford", "Chelmsford City"], "Essex", "Europe/London", "GB");

put(places, ["Leopardstown"], "County Dublin", "Europe/Dublin", "IE");
put(places, ["Curragh", "The Curragh", "Naas", "Punchestown"], "County Kildare", "Europe/Dublin", "IE");
put(places, ["Fairyhouse", "Navan", "Bellewstown", "Laytown"], "County Meath", "Europe/Dublin", "IE");
put(places, ["Gowran", "Gowran Park"], "County Kilkenny", "Europe/Dublin", "IE");
put(places, ["Cork", "Cork Racecourse", "Mallow"], "County Cork", "Europe/Dublin", "IE");
put(places, ["Limerick"], "County Limerick", "Europe/Dublin", "IE");
put(places, ["Galway"], "County Galway", "Europe/Dublin", "IE");
put(places, ["Listowel", "Killarney"], "County Kerry", "Europe/Dublin", "IE");
put(places, ["Tramore"], "County Waterford", "Europe/Dublin", "IE");
put(places, ["Clonmel", "Thurles", "Tipperary"], "County Tipperary", "Europe/Dublin", "IE");
put(places, ["Dundalk"], "County Louth", "Europe/Dublin", "IE");
put(places, ["Down Royal", "Downpatrick"], "County Down", "Europe/London", "GB");
put(places, ["Ballinrobe"], "County Mayo", "Europe/Dublin", "IE");
put(places, ["Sligo"], "County Sligo", "Europe/Dublin", "IE");
put(places, ["Roscommon"], "County Roscommon", "Europe/Dublin", "IE");
put(places, ["Wexford"], "County Wexford", "Europe/Dublin", "IE");
put(places, ["Kilbeggan"], "County Westmeath", "Europe/Dublin", "IE");

put(places, ["Flemington", "Caulfield", "Moonee Valley", "Sandown"], "Victoria", "Australia/Melbourne", "AU");
put(places, ["Randwick", "Royal Randwick", "Rosehill", "Rosehill Gardens", "Warwick Farm", "Canterbury"], "New South Wales", "Australia/Sydney", "AU");
put(places, ["Eagle Farm", "Doomben"], "Queensland", "Australia/Brisbane", "AU");
put(places, ["Morphettville"], "South Australia", "Australia/Adelaide", "AU");
put(places, ["Ascot"], "Western Australia", "Australia/Perth", "AU");

put(places, ["Turffontein"], "Gauteng", "Africa/Johannesburg", "ZA");
put(places, ["Kenilworth", "Durbanville"], "Western Cape", "Africa/Johannesburg", "ZA");
put(places, ["Greyville", "Hollywoodbets Greyville", "Scottsville"], "KwaZulu-Natal", "Africa/Johannesburg", "ZA");
put(places, ["Fairview"], "Eastern Cape", "Africa/Johannesburg", "ZA");

put(places, ["Mumbai", "Mahalaxmi", "Pune"], "Maharashtra", "Asia/Kolkata", "IN");
put(places, ["Bengaluru", "Bangalore"], "Karnataka", "Asia/Kolkata", "IN");
put(places, ["Mysuru", "Mysore"], "Karnataka", "Asia/Kolkata", "IN");
put(places, ["Chennai", "Guindy", "Ooty", "Udhagamandalam"], "Tamil Nadu", "Asia/Kolkata", "IN");
put(places, ["Hyderabad", "Malakpet"], "Telangana", "Asia/Kolkata", "IN");
put(places, ["Kolkata", "Calcutta"], "West Bengal", "Asia/Kolkata", "IN");
put(places, ["Delhi"], "Delhi", "Asia/Kolkata", "IN");

put(places, ["Sha Tin", "Shatin", "Happy Valley"], "Hong Kong", "Asia/Hong_Kong", "HK");

put(places, ["Ellerslie", "Pukekohe", "Avondale"], "Auckland", "Pacific/Auckland", "NZ");
put(places, ["Te Rapa", "Matamata", "Taupo"], "Waikato", "Pacific/Auckland", "NZ");
put(places, ["Tauranga"], "Bay of Plenty", "Pacific/Auckland", "NZ");
put(places, ["Hastings"], "Hawke's Bay", "Pacific/Auckland", "NZ");
put(places, ["Awapuni"], "Manawatu-Whanganui", "Pacific/Auckland", "NZ");
put(places, ["Trentham"], "Wellington", "Pacific/Auckland", "NZ");
put(places, ["Riccarton"], "Canterbury", "Pacific/Auckland", "NZ");
put(places, ["Wingatui"], "Otago", "Pacific/Auckland", "NZ");
put(places, ["Ascot Park"], "Southland", "Pacific/Auckland", "NZ");

put(places, ["Bendigo", "Ballarat", "Geelong", "Cranbourne", "Mornington", "Pakenham", "Sandown Hillside", "Sandown Lakeside"], "Victoria", "Australia/Melbourne", "AU");
put(places, ["Newcastle", "Wyong", "Gosford", "Kembla Grange", "Hawkesbury"], "New South Wales", "Australia/Sydney", "AU");
put(places, ["Gold Coast", "Sunshine Coast", "Ipswich", "Toowoomba"], "Queensland", "Australia/Brisbane", "AU");
put(places, ["Belmont", "Pinjarra"], "Western Australia", "Australia/Perth", "AU");
put(places, ["Hobart", "Launceston"], "Tasmania", "Australia/Hobart", "AU");
put(places, ["Darwin", "Alice Springs"], "Northern Territory", "Australia/Darwin", "AU");

export function lookupCourse(name: string, countryCode: string): CoursePlace | undefined {
  return places[`${countryCode}|${key(name)}`];
}

export function courseKey(name: string): string {
  return key(name);
}

const $ = id => document.getElementById(id);

const cities = {
  jakarta:{name:"Jakarta",lat:-6.2088,lon:106.8456}, depok:{name:"Depok",lat:-6.4025,lon:106.7942},
  bogor:{name:"Bogor",lat:-6.5971,lon:106.806}, bandung:{name:"Bandung",lat:-6.9175,lon:107.6191},
  surabaya:{name:"Surabaya",lat:-7.2575,lon:112.7521}, yogyakarta:{name:"Yogyakarta",lat:-7.7956,lon:110.3695},
  semarang:{name:"Semarang",lat:-6.9667,lon:110.4167}, medan:{name:"Medan",lat:3.5952,lon:98.6722},
  makassar:{name:"Makassar",lat:-5.1477,lon:119.4327}, denpasar:{name:"Denpasar",lat:-8.65,lon:115.2167}
};
const codes = {
  0:["Cerah","☀️"],1:["Cerah berawan","🌤️"],2:["Berawan sebagian","⛅"],3:["Berawan","☁️"],
  45:["Berkabut","🌫️"],48:["Kabut tebal","🌫️"],51:["Gerimis ringan","🌦️"],53:["Gerimis","🌦️"],
  55:["Gerimis lebat","🌧️"],61:["Hujan ringan","🌦️"],63:["Hujan sedang","🌧️"],65:["Hujan lebat","🌧️"],
  80:["Hujan lokal ringan","🌦️"],81:["Hujan lokal","🌧️"],82:["Hujan lokal lebat","⛈️"],95:["Badai petir","⛈️"],
  96:["Badai petir dan hujan es","⛈️"],99:["Badai petir kuat","⛈️"]
};
const dateOptions = {timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"};
let weather = {name:"Jakarta",label:"Cuaca belum tersedia",icon:"🌤️",temp:null};
let bmkgOffset = null;
let bmkgLastSync = 0;

function wibParts(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const o={}; p.forEach(x=>{if(x.type!=="literal")o[x.type]=x.value;});
  return {hour:+o.hour,minute:+o.minute,second:+o.second};
}
function nowMs() {
  // Offset BMKG diperoleh lewat /api/time; jika gagal, gunakan jam perangkat dengan zona Asia/Jakarta.
  return bmkgOffset === null ? Date.now() : Date.now() + bmkgOffset;
}
function renderClock() {
  const d = new Date(nowMs());
  const t = wibParts(d);
  $("clock").textContent = `${String(t.hour).padStart(2,"0")}:${String(t.minute).padStart(2,"0")}:${String(t.second).padStart(2,"0")}`;
  $("dateLine").textContent = new Intl.DateTimeFormat("id-ID",dateOptions).format(d);
  renderGreeting(t.hour);
  renderWorkAlert(t.hour,t.minute);
  const start = new Date(d.getFullYear(),0,0);
  const day = Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);
  const daysYear = (new Date(d.getFullYear(),1,29).getMonth()===1) ? 366 : 365;
  $("dayOfYear").textContent = day;
  $("daysLeft").textContent = daysYear-day;
}
function renderGreeting(hour) {
  // Salam khusus IT RSBY mengikuti waktu WIB secara otomatis.
  const minute = wibParts(new Date(nowMs())).minute;
  const totalMinutes = hour * 60 + minute;
  let greeting, icon;

  if (totalMinutes >= 8 * 60 && totalMinutes <= 10 * 60 + 30) {
    greeting = "Selamat pagi IT RSBY";
    icon = "☀";
  } else if (totalMinutes >= 11 * 60 && totalMinutes <= 14 * 60) {
    greeting = "Selamat siang IT RSBY";
    icon = "☀";
  } else if (totalMinutes >= 15 * 60 && totalMinutes <= 17 * 60) {
    greeting = "Selamat sore IT RSBY";
    icon = "☼";
  } else if (totalMinutes > 17 * 60) {
    greeting = "Selamat malam IT RSBY";
    icon = "☾";
  } else {
    // Di luar rentang salam khusus, tidak menampilkan salam pagi/siang/sore.
    greeting = "Halo IT RSBY";
    icon = "✦";
  }

  const wet = /hujan|gerimis|badai/i.test(weather.label);
  const sunny = /cerah/i.test(weather.label);
  $("greeting").textContent = greeting;
  $("greetingIcon").textContent = wet ? "☂" : icon;
  $("greetingMessage").textContent = wet
    ? "Cuaca berpotensi basah, jangan lupa membawa payung dan tetap berhati-hati."
    : sunny
      ? "Semoga aktivitas tim IT RSBY lancar di tengah cuaca cerah hari ini."
      : "Semoga aktivitas tim IT RSBY berjalan lancar dan tetap jaga kesehatan.";
  $("weatherNote").textContent = wet
    ? "Cuaca sedang hujan atau berpotensi hujan. Pertimbangkan payung saat bepergian."
    : sunny
      ? "Cuaca cerah. Tetap perhatikan kebutuhan cairan dan aktivitas luar ruang."
      : "Pantau kondisi cuaca sebelum melakukan aktivitas di luar ruangan.";
}
function renderWorkAlert(hour,minute) {
  const total=hour*60+minute;
  if(total>=1020){
    $("workKicker").textContent="WAKTU PULANG";
    $("workMessage").textContent="Jam kerja sudah habis, waktunya pulang!";
    $("workSub").textContent="Pukul 17.00 telah lewat. Simpan pekerjaan dan pastikan perangkat aman.";
  } else if(total>=990){
    $("workKicker").textContent="PENGINGAT JAM KERJA";
    $("workMessage").textContent="Sebentar lagi jam kerja selesai.";
    $("workSub").textContent="Pukul 17.00 waktunya pulang. Rapikan pekerjaan sebelum meninggalkan ruangan.";
  } else {
    $("workKicker").textContent="PENGINGAT JAM KERJA";
    $("workMessage").textContent="Jam kerja berakhir pukul 17.00";
    $("workSub").textContent="Semoga pekerjaan hari ini berjalan lancar.";
  }
}
async function syncBMKG() {
  const before=Date.now();
  try {
    const response=await fetch(`/api/time?ts=${before}`,{cache:"no-store"});
    if(!response.ok) throw new Error("Endpoint waktu tidak tersedia");
    const data=await response.json();
    const after=Date.now();
    if(typeof data.epochMs!=="number") throw new Error("Format waktu tidak dikenali");
    // Perkirakan offset menggunakan titik tengah request untuk mengurangi efek latency.
    bmkgOffset=data.epochMs-((before+after)/2);
    bmkgLastSync=after;
    $("syncStatus").textContent="Waktu tersinkronisasi BMKG";
    $("syncDot").className="sync-dot online";
    $("sourceLabel").textContent="Server waktu BMKG";
  } catch(err) {
    if(bmkgOffset===null) {
      $("syncStatus").textContent="Mode cadangan · waktu perangkat";
      $("syncDot").className="sync-dot offline";
      $("sourceLabel").textContent="Jam perangkat · WIB";
    } else {
      $("syncStatus").textContent="BMKG terputus · memakai sinkronisasi terakhir";
    }
  }
  renderClock();
}
async function fetchWeather(key) {
  const c=cities[key]||cities.jakarta;
  weather.name=c.name;
  $("weatherLocation").textContent=`⌖ ${c.name}, Indonesia`;
  try {
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=Asia%2FJakarta&forecast_days=1`;
    const r=await fetch(url);
    if(!r.ok) throw new Error("Data cuaca gagal dimuat");
    const d=await r.json(), cur=d.current, desc=codes[cur.weather_code]||["Kondisi cuaca terkini","🌤️"];
    weather.label=desc[0];weather.icon=desc[1];weather.temp=cur.temperature_2m;
    $("weatherIcon").textContent=weather.icon;
    $("temperature").textContent=`${Math.round(weather.temp)}°C`;
    $("weatherDescription").textContent=weather.label;
    const fmt=v=>v?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(v)):"--:--";
    $("sunrise").textContent=fmt(d.daily?.sunrise?.[0]);
    $("sunset").textContent=fmt(d.daily?.sunset?.[0]);
    $("weatherUpdated").textContent="Data terkini";
    renderClock();
  } catch(err) {
    $("weatherDescription").textContent="Cuaca tidak dapat dimuat";
    $("weatherUpdated").textContent="Periksa internet";
  }
}
function setSetting(key,value) {
  if(key==="background") document.body.dataset.bg=value;
  if(key==="accent") document.body.dataset.accent=value;
  if(key==="font") document.documentElement.style.setProperty("--font-clock",`'${value}',monospace`);
  localStorage.setItem(`jamwib-${key}`,value);
}
function loadSettings() {
  const defaults={background:"midnight",accent:"mint",font:"Orbitron",city:"jakarta"};
  for(const [key,def] of Object.entries(defaults)){
    const val=localStorage.getItem(`jamwib-${key}`)||def;
    const control=$(key==="background"?"backgroundSelect":key==="accent"?"accentSelect":key==="font"?"fontSelect":"citySelect");
    control.value=val;
    if(key!=="city")setSetting(key,val);
  }
  return localStorage.getItem("jamwib-city")||"jakarta";
}
$("backgroundSelect").addEventListener("change",e=>setSetting("background",e.target.value));
$("accentSelect").addEventListener("change",e=>setSetting("accent",e.target.value));
$("fontSelect").addEventListener("change",e=>setSetting("font",e.target.value));
$("citySelect").addEventListener("change",e=>{localStorage.setItem("jamwib-city",e.target.value);fetchWeather(e.target.value);});
$("resetBtn").addEventListener("click",()=>{
  ["background","accent","font","city"].forEach(k=>localStorage.removeItem(`jamwib-${k}`));
  const c=loadSettings();fetchWeather(c);
});
const city=loadSettings();
renderClock();
fetchWeather(city);
syncBMKG();
setInterval(renderClock,250);
setInterval(syncBMKG,60_000);
setInterval(()=>fetchWeather($("citySelect").value),15*60_000);

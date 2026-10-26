// Vercel Serverless Function: mengambil waktu dari halaman endpoint waktu BMKG.
// Endpoint ini menghindari masalah CORS pada browser. Format server BMKG dapat berubah,
// sehingga fungsi mengembalikan error dan website beralih ke jam perangkat jika parsing gagal.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const endpoints = [
    "https://ntp.bmkg.go.id/JamServer.php",
    "https://time.bmkg.go.id/JamServer.php",
    "https://jam.bmkg.go.id/JamServer.php"
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { "User-Agent": "JamWIB-Web/1.0" },
        signal: AbortSignal.timeout(4500),
        cache: "no-store"
      });
      if (!response.ok) continue;
      const body = await response.text();

      // Bentuk yang pernah dipublikasikan endpoint: new Date(2026,09-1,11,12,49,18)
      const match = body.match(/new\s+Date\s*\(\s*(\d{4})\s*,\s*(\d{1,2})\s*-\s*1\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})?/i);
      if (match) {
        const [, year, month, day, hour, minute, second = "0"] = match;
        // JamServer.php memakai waktu WIB. Date.UTC di sini mengubah WIB ke epoch UTC.
        const epochMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute), Number(second));
        if (Number.isFinite(epochMs)) {
          res.status(200).json({ epochMs, source: "BMKG", checkedAt: new Date().toISOString() });
          return;
        }
      }

      // Fallback parsing bila respons berisi teks tanggal waktu Indonesia.
      const textMatch = body.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*WIB/i);
      if (textMatch) {
        const months = { januari:0, februari:1, maret:2, april:3, mei:4, juni:5, juli:6, agustus:7, september:8, oktober:9, november:10, desember:11 };
        const [, day, monthName, year, hour, minute, second] = textMatch;
        const month = months[monthName.toLowerCase()];
        if (month !== undefined) {
          const epochMs = Date.UTC(+year, month, +day, +hour - 7, +minute, +second);
          res.status(200).json({ epochMs, source: "BMKG", checkedAt: new Date().toISOString() });
          return;
        }
      }
    } catch (error) {
      // Coba endpoint BMKG berikutnya.
    }
  }

  res.status(502).json({ error: "Tidak dapat membaca waktu dari endpoint BMKG saat ini." });
}

/////////////////////////////////////////////////////////////
//        MODULES MẪU SỬ DỤNG API KEY CỦA TÍNH ĐIỂM        //
/////////////////////////////////////////////////////////////

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const moment = require("moment-timezone");

const KEYS_FILE = path.join(__dirname, "data", "keys.json");
const CACHE_DIR = path.join(__dirname, "cache");
const API_URL = process.env.API_URL || 'https://legistudio.site/api-legi/tinhdiem';
const API_KEY = process.env.API_KEY || 'API_KEY'; //thay api key của bạn vào đây 
const TIME_ZONE = "Asia/Ho_Chi_Minh";

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const SLOTS = [
  { label: "13:00-15:00", start: "13:00", end: "15:00" },
  { label: "15:00-17:00", start: "15:00", end: "17:00" },
  { label: "17:00-19:00", start: "17:00", end: "19:00" },
  { label: "20:00-21:30", start: "20:00", end: "21:30" },
  { label: "21:40-23:30", start: "21:40", end: "23:30" },
  { label: "23:30-01:00", start: "23:30", end: "01:00" },
  { label: "01:00-03:00", start: "01:00", end: "03:00" },
  { label: "10:00-12:00", start: "10:00", end: "12:00" }
];

function readKeys() {
  try {
    return fs.existsSync(KEYS_FILE) ? JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) : {};
  } catch (e) {
    return {};
  }
}

function formatApiTime(m) {
  return moment(m).tz(TIME_ZONE).format("YYYY/MM/DD HH:mm:ss");
}

function parseXoa(t) {
  if (!t) return null;
  let s = String(t).toLowerCase();
  if (s.startsWith("xoa=")) return s.slice(4);
  if (s.startsWith("xoa")) return s.slice(3);
  if (s.startsWith("last:")) return s;
  return null;
}

function parseCpr(t) {
  if (!t) return null;
  const m = String(t).toLowerCase().match(/cpr(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseTimeInput(str) {
  if (!str) return null;
  let s = String(str).trim();
  s = s.replace(/[Hh]/g, ":");
  s = s.replace(/\s+/g, "");
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2], 10) : 0;
  if (min >= 24) min = 0;
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function saveBase64ToFile(base64, prefix = "td") {
  const file = path.join(CACHE_DIR, `${prefix}_${Date.now()}.png`);
  const raw = (String(base64).includes(",")) ? base64.split(",")[1] : base64;
  fs.writeFileSync(file, Buffer.from(raw, "base64"));
  return file;
}

function checkKeyPermission(keyInfo, uid) {
  if (!keyInfo) return false;
  const list = [...(keyInfo.admins || []), ...(keyInfo.ctvs || [])].map(String);
  return list.length === 0 || list.includes(String(uid));
}

function calcSlotTime(slot, now) {
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);

  let start = moment.tz(now.format("YYYY-MM-DD"), TIME_ZONE).hour(sh).minute(sm).second(0);
  let end = moment.tz(now.format("YYYY-MM-DD"), TIME_ZONE).hour(eh).minute(em).second(0);

  if (!end.isAfter(start)) {
    const midnightEnd = moment.tz(now.format("YYYY-MM-DD") + " 23:59:59", TIME_ZONE);
    if (now.isBetween(start, midnightEnd, null, "[]")) {
      end.add(1, "day");
    } else {
      start.subtract(1, "day");
    }
  }

  return { start, end };
}

function buildTinhDiemUrl(opts) {
  const {
    endpoint, apikey, id, batdau, ketthuc, bang,
    ct, ct2, logo, xoatran, cpr
  } = opts;

  let url = `${endpoint}?apikey=${encodeURIComponent(apikey)}`;
  url += `&id=${encodeURIComponent(id)}`;
  url += `&batdau=${encodeURIComponent(batdau)}`;
  url += `&ketthuc=${encodeURIComponent(ketthuc)}`;
  url += `&bang=${encodeURIComponent(bang)}`;
  url += `&ct=${encodeURIComponent(ct || "")}`;
  url += `&ct2=${encodeURIComponent(ct2 || "")}`;
  url += `&logo=${encodeURIComponent(logo || "")}`;

  if (xoatran) url += `&xoatran=${encodeURIComponent(xoatran)}`;
  if (cpr) url += `&cpr=${encodeURIComponent(cpr)}`;

  return url;
}

async function callTinhDiem({
  api, threadID, messageID,
  idgame, keyName, keyInfo,
  start, end, xoa, cpr
}) {

const paramsObj = {
  endpoint: API_URL,
  apikey: API_KEY,
  id: idgame,
  batdau: formatApiTime(start),
  ketthuc: formatApiTime(end),
  bang: keyInfo.idbang || keyInfo.idBang || keyName,
  ct: keyInfo.ct || "",
  ct2: keyInfo.ct2 || "",
  logo: keyInfo.logo || "",
  xoatran: xoa,
  cpr: cpr
};

  let apiUrl;
  try {
    apiUrl = buildTinhDiemUrl(paramsObj);
  } catch (err) {
    return api.sendMessage("❌ Lỗi khi tạo URL gọi API", threadID, messageID);
  }

    api.sendMessage(`⌛ Bắt đầu tính điểm`, threadID, messageID);

  try {
    const res = await axios.get(apiUrl, { responseType: "json", timeout: 45000 });

    if (!res.data || res.data.status === false) {
      const msg = res.data?.message || "API tính điểm trả về lỗi";
      return api.sendMessage(`❌ ${msg}`, threadID, messageID);
    }

    const cprObj = res.data.cpr || null;
    const threshold = cprObj?.threshold ?? cpr ?? null;
    const cprStatus = cprObj?.status ?? null;
    const cprTeam = cprObj?.team ?? null;

    if (!res.data.base) {
      let msg =
        `🤖 ${keyInfo.ct || "LEGI STUDIO TĐ"} 🤖\n\n` +
        `📊 ID: ${idgame}\n` +
        `🎯 Số Trận: ${res.data.sotran ?? "—"}\n` +
        `⌛ Khung Giờ: ${start.format("HH:mm | DD/MM")}\n` +
        `🔑 Key: ${keyName}\n`;

      if (xoa) msg += `\n🗑 Xóa Trận: ${xoa}`;
      if (cpr || cprObj) {
        msg += `\n🔹 CPR: ${threshold ?? "—"} Điểm\n`;
        msg += `🏆 Team CPR: ${(cprStatus === "found" && cprTeam) ? cprTeam : "không có"}\n`;
      }
      return api.sendMessage(`${msg}\n❗ API không trả ảnh`, threadID, messageID);
    }

    const imgFile = saveBase64ToFile(res.data.base, "td");

    let msg =
      `🤖 ${keyInfo.ct || "LEGI STUDIO TĐ"} 🤖\n\n` +
      `📊 ID: ${idgame}\n` +
      `🎯 Số Trận: ${res.data.sotran ?? "—"}\n` +
      `⌛ Khung Giờ: ${start.format("HH:mm | DD/MM")}\n` +
      `🔑 Key: ${keyName}\n`;

    if (xoa) msg += `\n🗑 Xóa Trận: ${xoa}`;
    if (cpr || cprObj) {
      msg += `\n🔹 CPR: ${threshold ?? "—"} Điểm\n`;
      msg += `🏆 Team CPR: ${(cprStatus === "found" && cprTeam) ? cprTeam : "không có"}\n`;
    }

    api.sendMessage({ body: msg, attachment: fs.createReadStream(imgFile) }, threadID, (err) => {
      try { fs.unlinkSync(imgFile); } catch (e) {}
      void err;
    });

  } catch (err) {
    let msg = "Lỗi gọi API";
    if (err.response?.data?.message) msg = err.response.data.message;
    else if (err.message) msg = err.message;
    return api.sendMessage(`❌ ${msg}`, threadID, messageID);
  }
}

module.exports.config = {
  name: 'tinhdiem',
  version: '1.0',
  hasPermssion: 2, // đặt thành 0 nếu Permssion user = 0
  Rent: 1,
  credits: 'Dev by LEGI STUDIO - ZanHau',
  description: 'Basic Modules Tạo Tính Điểm Qua API',
  commandCategory: 'Tính Điểm',
  usages: '.tinhdiem',
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  if (!args || !args[0]) {
    return api.sendMessage(
      "Cách dùng:\n" +
      ".tinhdiem <id> [key] [xoa1,3] [cpr50] (rút gọn -> chọn khung giờ)\n" +
      ".tinhdiem <id> <start DD/MM/YYYY> <startTime> <end DD/MM/YYYY> <endTime> [key] [xoa..] [cpr..]\n" +
      "Ví dụ:\n.tinhdiem 123456789 fftest xoa1,3 cpr50\n.tinhdiem 123456789 01/01/2026 13:00 01/01/2026 15:00 fftest\n",
      threadID, messageID
    );
  }

  const keys = readKeys();
  const idgame = args[0];
  const tokensFiltered = args.slice(1);
  let keyName = null;
  if (tokensFiltered.length && keys[tokensFiltered[0]]) {
    keyName = tokensFiltered[0];
  } else {
    for (let t of tokensFiltered) {
      if (keys[t]) {
        keyName = t;
        break;
      }
    }
  }
  if (!keyName) keyName = "fftest";

  const keyInfo = keys[keyName];
  if (!keyInfo) return api.sendMessage(`❌ Key ${keyName} không tồn tại`, threadID, messageID);
  if (!checkKeyPermission(keyInfo, senderID)) return api.sendMessage("❌ Bạn không có quyền dùng key này", threadID, messageID);

  let xoa = null, cpr = null;
  args.slice(1).forEach(t => {
    const l = String(t).toLowerCase();
    if (!xoa) xoa = parseXoa(l);
    if (!cpr) cpr = parseCpr(l);
  });

  let fullDetected = false;
  let startMoment = null, endMoment = null;
  if (args.length >= 5) {
    const d1 = args[1];
    const t1raw = args[2];
    const d2 = args[3];
    const t2raw = args[4];
    const dateRegex = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/;
    const t1 = parseTimeInput(t1raw);
    const t2 = parseTimeInput(t2raw);

    if (dateRegex.test(d1) && dateRegex.test(d2) && t1 && t2) {
      startMoment = moment.tz(`${d1} ${t1}`, "D/M/YYYY HH:mm", TIME_ZONE);
      endMoment = moment.tz(`${d2} ${t2}`, "D/M/YYYY HH:mm", TIME_ZONE);
      fullDetected = true;
    }
  }

  if (fullDetected) {
    if (!startMoment.isValid() || !endMoment.isValid()) {
      return api.sendMessage("❌ Sai định dạng ngày giờ. Dùng DD/MM/YYYY và giờ như 13:00 hoặc 13h5", threadID, messageID);
    }
    if (!endMoment.isAfter(startMoment)) {
      return api.sendMessage("❌ Endtime phải lớn hơn Starttime", threadID, messageID);
    }

    return callTinhDiem({
      api, threadID, messageID,
      idgame, keyName, keyInfo,
      start: startMoment,
      end: endMoment,
      xoa,
      cpr
    });
  }

  let menu = "⌛ Các Khung Giờ Tính Điểm ⌛\n\n";
  SLOTS.forEach((s, i) => menu += `${i + 1}. ${s.label}\n`);
  menu += `\nReply số để chọn khung giờ.\nYêu cầu bởi: ${senderID}`;

  return api.sendMessage(menu, threadID, (err, info) => {
    global.client.handleReply.push({
      name: "tinhdiem",
      type: "td_select_slot",
      messageID: info.messageID,
      author: senderID,
      data: {
        idgame,
        keyName,
        xoa,
        cpr
      }
    });
  }, messageID);
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { body, senderID, threadID, messageID } = event;
  if (!handleReply || handleReply.author !== senderID) return;
  if (handleReply.type !== "td_select_slot") return;

  const pick = Number(body.trim());
  if (isNaN(pick) || pick < 1 || pick > SLOTS.length) {
    return api.sendMessage("❌ Lựa chọn không hợp lệ", threadID, messageID);
  }

  const slot = SLOTS[pick - 1];
  const now = moment.tz(TIME_ZONE);
  const { start, end } = calcSlotTime(slot, now);

  const keys = readKeys();
  const keyInfo = keys[handleReply.data.keyName];
  if (!keyInfo) return api.sendMessage("❌ Key không tìm thấy (lỗi)", threadID, messageID);

  return callTinhDiem({
    api, threadID, messageID,
    idgame: handleReply.data.idgame,
    keyName: handleReply.data.keyName,
    keyInfo,
    start, end,
    xoa: handleReply.data.xoa,
    cpr: handleReply.data.cpr
  });
};

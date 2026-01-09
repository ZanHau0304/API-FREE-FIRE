////////////////////////////////////////////////////////////
//       MODULES MẪU SỬ DỤNG API KEY CỦA HỒ SƠ TEAM       //
////////////////////////////////////////////////////////////

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const downloader = require("image-downloader");

const API_BASE = process.env.API_BASE || "https://legistudio.site";
const BOT_KEY  = process.env.BOT_KEY || "API_KEY"; //thay api key của bạn vào đây 

const CACHE_DIR = path.join(__dirname, "cache_team");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function getCache(senderID) {
  const p = path.join(CACHE_DIR, String(senderID));
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return p;
}
 
setInterval(() => {
  const now = Date.now();
  fs.readdirSync(CACHE_DIR).forEach(dir => {
    const p = path.join(CACHE_DIR, dir);
    const stat = fs.statSync(p);
    if (now - stat.mtimeMs > 30 * 24 * 1000) {
      fs.removeSync(p);
    }
  });
}, 10 * 24 * 1000);
 
async function streamURL(url, senderID) {
  const dest = path.join(getCache(senderID), Date.now() + ".png");
  await downloader.image({ url, dest });
  return fs.createReadStream(dest);
}

function extractApiError(err) {
  try {
    if (!err) return "Lỗi kết nối";
    if (err.response) { 
      const d = err.response.data;
      if (d) {
        if (typeof d === "string") return d;
        if (d.message) return d.message;
        if (d.error) return d.error; 
        if (d.status === false && d.message) return d.message; 
        try { return JSON.stringify(d); } catch (e) {}
      } 
      return `HTTP ${err.response.status} ${err.response.statusText || ''}`.trim();
    } 
    if (err.code === "ECONNABORTED") return "Kết nối tới API bị timeout";
    if (err.message) return err.message;
    return "Lỗi kết nối";
  } catch (e) {
    return "Lỗi không xác định";
  }
} 

async function apiAddTeam({ uid, teamName, ids, mode, imageUrl }) {
  try {
    const form = new FormData();
    form.append("uid", uid);
    form.append("teamName", teamName);
    form.append("accountIDs", JSON.stringify(ids));
    form.append("mode", mode);

    if (imageUrl) {
      const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
      form.append("image", img.data, { filename: "logo.png" });
    }

    const res = await axios.post(
      API_BASE + "/api-legi/team/add",
      form,
      { headers: { ...form.getHeaders(), "x-bot-key": BOT_KEY }, timeout: 20000 }
    );
 
    return res.data || { success: false, message: "Không có phản hồi từ server" };
  } catch (e) {
    return { success: false, message: extractApiError(e) };
  }
}

module.exports.config = {
  name: "team",
  version: '1.0',
  hasPermssion: 2, // đặt thành 0 nếu Permssion user = 0
  Rent: 1,
  credits: 'Dev by LEGI STUDIO - ZanHau',
  description: "Quản lý hồ sơ team Free Fire Qua API",
  commandCategory: "Tính Điểm",
  usages: "",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, messageReply, senderID } = event;
  const uid = senderID;

  if (!args[0]) {
    return api.sendMessage(
      "📌 TEAM\n\n" +
      "➕ add Tên, ID (hoặc nhiều dòng: Tên, id1,id2)\n" +
      "➕ addv (viền)\n\n" +
      "📋 list [trang] — ví dụ: list 2\n" +
      "ℹ️ info Tên\n" +
      "🗑️ remove Tên",
      threadID,
      messageID
    );
  }

  if (["add", "adds", "addv"].includes(args[0])) {
    const mode =
      args[0] === "addv" ? "border" : "original";

    const lines = args.slice(1).join(" ").split("\n");
    const attachments = messageReply?.attachments || [];
    let out = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",").map(x => x.trim()).filter(Boolean);
      let teamName = "";
      let ids = [];

      for (const p of parts) {
        if (/^\d{6,20}$/.test(p)) ids.push(p);
        else if (!teamName) teamName = p.toUpperCase();
      }

      if (!teamName || !ids.length) {
        out.push("⚠️ Thiếu tên hoặc ID");
        continue;
      }

      try {
        const res = await apiAddTeam({
          uid,
          teamName,
          ids,
          mode,
          imageUrl: attachments[i]?.url || null
        });

        if (res && (res.success || res.status === true)) {
          const action = res.action || (res.addedIDs && res.addedIDs.length ? 'update' : 'create');
          const added = Array.isArray(res.addedIDs) ? res.addedIDs.join(", ") : (res.addedIDs ? String(res.addedIDs) : "");
          const all = Array.isArray(res.allIDs) ? res.allIDs.join(", ") : (res.allIDs ? String(res.allIDs) : "");
          const logo = (res.logo && String(res.logo).toLowerCase() !== 'không') ? 'Có' : 'Không';

          let msg = `${action === 'create' ? '✅ Tạo team thành công' : '♻️ Cập nhật team thành công'}\n`;
          msg += `Tên: ${res.teamName || teamName}\n`;
          if (added) msg += `Mới thêm: ${added}\n`;
          if (all) msg += `Tất cả ID: ${all}\n`;
          msg += `Logo: ${logo}`;

          out.push(msg);
        } else {
          const errMsg = (res && (res.message || res.error)) ? (res.message || res.error) : 'Lỗi server';
          out.push(`❌ ${teamName} lỗi: ${errMsg}`);
        }
      } catch (e) {
        const em = extractApiError(e);
        out.push(`❌ ${teamName} lỗi: ${em}`);
      }
    }

    return api.sendMessage(out.join("\n\n"), threadID, messageID);
  }

  if (args[0] === "list") {
    const page = Math.max(1, parseInt(args[1] || "1", 10) || 1);
    const perPage = 10;

    try {
      const res = await axios.get(
        API_BASE + "/api-legi/team/list",
        { params: { uid }, headers: { "x-bot-key": BOT_KEY }, timeout: 20000 }
      );

      if (!res || !res.data) {
        return api.sendMessage("❌ Lỗi list: Không có phản hồi từ API", threadID, messageID);
      }

      if (res.data.success === false) {
        const msg = res.data.message || "Lỗi từ API";
        return api.sendMessage(`❌ Lỗi list: ${msg}`, threadID, messageID);
      }

      const data = (res.data && res.data.data) || [];
      if (!data.length)
        return api.sendMessage("📌 Chưa có team", threadID, messageID);

      const total = data.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      if (page > totalPages) return api.sendMessage(`❌ Trang không tồn tại (tổng ${totalPages} trang)`, threadID, messageID);

      const start = (page - 1) * perPage;
      const pageItems = data.slice(start, start + perPage);

      let msg = `📋 DANH SÁCH TEAM — Trang ${page}/${totalPages} (tổng ${total}):\n`;
      pageItems.forEach((t, idx) => {
        const no = idx + 1;
        const logo = t.logo ? 'Có' : 'Không';
        const accs = Array.isArray(t.accountID) ? t.accountID.join(', ') : (t.accountID || '');
        msg += `${no}. ${t.teamName} | IDs: ${accs} | Logo: ${logo}\n`;
      });

      msg += `\nReply số để xem | del + số để xoá (trên trang này) | list ${page === 1 ? 1 : page - 1} / list ${Math.min(totalPages, page + 1)} để chuyển trang`;

      return api.sendMessage(msg, threadID, (err, info) => {
        global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: senderID,
          data: pageItems
        });
      }, messageID);

    } catch (e) {
      return api.sendMessage("❌ Lỗi list: " + extractApiError(e), threadID, messageID);
    }
  }

  if (args[0] === "info") {
    const teamName = args.slice(1).join(" ").toUpperCase();
    if (!teamName)
      return api.sendMessage("Thiếu tên team", threadID, messageID);

    try {
      const res = await axios.get(
        API_BASE + "/api-legi/team/info",
        { params: { uid, teamName }, headers: { "x-bot-key": BOT_KEY }, timeout: 20000 }
      );

      if (!res || !res.data) {
        return api.sendMessage("❌ Lỗi info: Không có phản hồi từ API", threadID, messageID);
      }
      if (res.data.success === false) {
        return api.sendMessage(`❌ Lỗi info: ${res.data.message || 'Lỗi từ API'}`, threadID, messageID);
      }

      const t = res.data.data;
      const msg = `📌 ${t.teamName}\n👥 ${Array.isArray(t.accountID) ? t.accountID.join(", ") : (t.accountID || '')}`;

      if (t.logo) {
        return api.sendMessage(
          { body: msg, attachment: await streamURL(API_BASE + t.logo, senderID) },
          threadID,
          messageID
        );
      }

      return api.sendMessage(msg, threadID, messageID);

    } catch (e) {
      return api.sendMessage("❌ Lỗi info: " + extractApiError(e), threadID, messageID);
    }
  }

  if (["remove", "rm"].includes(args[0])) {
    const teamName = args.slice(1).join(" ").toUpperCase();
    if (!teamName)
      return api.sendMessage("Thiếu tên team", threadID, messageID);

    try {
      const res = await axios.delete(
        API_BASE + "/api-legi/team/remove",
        {
          params: { uid, teamName },
          headers: { "x-bot-key": BOT_KEY },
          timeout: 20000
        }
      );

      if (!res || !res.data) {
        return api.sendMessage("❌ Lỗi xoá team: Không có phản hồi từ API", threadID, messageID);
      }
      if (res.data.success === false) {
        return api.sendMessage(`❌ Lỗi xoá team: ${res.data.message || 'Lỗi từ API'}`, threadID, messageID);
      }

      return api.sendMessage(res.data.message || "🗑️ Đã xoá team", threadID, messageID);
    } catch (e) {
      return api.sendMessage("❌ Lỗi xoá team: " + extractApiError(e), threadID, messageID);
    }
  }
}; 

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { body, senderID, threadID, messageID } = event;
  if (senderID !== handleReply.author) return;

  const input = body.trim().toLowerCase();
 
  if (input.startsWith("del")) {
    const idx = parseInt(input.replace("del", "").trim()) - 1;
    const team = handleReply.data[idx];
    if (!team)
      return api.sendMessage("❌ Số sai", threadID, messageID);

    try {
      const res = await axios.delete(
        API_BASE + "/api-legi/team/remove",
        {
          params: { uid: senderID, teamName: team.teamName },
          headers: { "x-bot-key": BOT_KEY },
          timeout: 20000
        }
      );

      if (!res || !res.data) {
        return api.sendMessage("❌ Lỗi xoá: Không có phản hồi từ API", threadID, messageID);
      }
      if (res.data.success === false) {
        return api.sendMessage(`❌ Lỗi xoá: ${res.data.message || 'Lỗi từ API'}`, threadID, messageID);
      }

      return api.sendMessage(res.data.message || "🗑️ Đã xoá", threadID, messageID);
    } catch (e) {
      return api.sendMessage("❌ Lỗi xoá: " + extractApiError(e), threadID, messageID);
    }
  }
 
  const idx = parseInt(input) - 1;
  const team = handleReply.data[idx];
  if (!team)
    return api.sendMessage("❌ Số sai", threadID, messageID);

  try {
    const res = await axios.get(
      API_BASE + "/api-legi/team/info",
      {
        params: { uid: senderID, teamName: team.teamName },
        headers: { "x-bot-key": BOT_KEY },
        timeout: 20000
      }
    );

    if (!res || !res.data) {
      return api.sendMessage("❌ Lỗi info: Không có phản hồi từ API", threadID, messageID);
    }
    if (res.data.success === false) {
      return api.sendMessage(`❌ Lỗi info: ${res.data.message || 'Lỗi từ API'}`, threadID, messageID);
    }

    const t = res.data.data;
    const msg = `📌 ${t.teamName}\n👥 ${Array.isArray(t.accountID) ? t.accountID.join(", ") : (t.accountID || '')}`;

    if (t.logo) {
      return api.sendMessage(
        { body: msg, attachment: await streamURL(API_BASE + t.logo, senderID) },
        threadID,
        messageID
      );
    }

    return api.sendMessage(msg, threadID, messageID);

  } catch (e) {
    return api.sendMessage("❌ Lỗi info: " + extractApiError(e), threadID, messageID);
  }
};

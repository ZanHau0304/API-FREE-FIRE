/////////////////////////////////////////////////////////////
//         MODULES MẪU SỬ DỤNG API KEY CỦA PROFILE         //
/////////////////////////////////////////////////////////////

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const SERVER_URL = process.env.API_URL || 'https://legistudio.site';
const API_KEY = process.env.API_KEY || 'API_KEY'; //thay api key của bạn vào đây 

const TMP_ROOT = path.join(__dirname, 'cache', 'profile_tmp');
fs.ensureDirSync(TMP_ROOT);

let profileCache = {
  layouts: [],
  loadedAt: 0
};

let userStep = {}; 

function scheduleExpiry(senderID, ms = 60 * 60 * 1000) {
  if (!userStep[senderID]) return;
  if (userStep[senderID].expiryTimer) clearTimeout(userStep[senderID].expiryTimer);
  userStep[senderID].expiryTimer = setTimeout(() => {
    try { delete userStep[senderID]; } catch (e) {}
  }, ms);
}

(async function loadLayoutsOnStart() {
  try {
    if (!API_KEY) return; //console.warn('[Profile] Không tìm thấy API_KEY');
    const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/profile/layouts?apikey=${encodeURIComponent(API_KEY)}`;
    const r = await axios.get(url, { timeout: 15000 });
    if (r.data && Array.isArray(r.data.layouts)) {
      profileCache.layouts = r.data.layouts;
      profileCache.loadedAt = Date.now();
      //console.log(`[Profile] Ghi nhận thành công ${profileCache.layouts.length} layouts`);
    }
  } catch (e) {
    //console.warn('[Profile] Không thể load layouts:', e.message || e);
  }
})();

async function tryUnsend(api, threadID, messageID) {
  if (!messageID) return;
  try { await api.unsendMessage(messageID); } catch (e) {}
}

module.exports.config = {
  name: 'profileff',
  version: '1.0',
  hasPermssion: 2, // đặt thành 0 nếu Permssion user = 0
  Rent: 1,
  credits: 'Dev by LEGI STUDIO - ZanHau',
  description: 'Basic Modules Tạo Profile Qua API',
  commandCategory: 'Tính Điểm',
  usages: '.profileff',
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  if (!profileCache.layouts || !profileCache.layouts.length) {
    if (!API_KEY) return api.sendMessage('❌ Server chưa cấu hình API KEY. Vui lòng liên hệ admin.', threadID, (e, info) => {});
    try {
      const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/profile/layouts?apikey=${encodeURIComponent(API_KEY)}`;
      const r = await axios.get(url, { timeout: 15000 });
      if (r.data && Array.isArray(r.data.layouts)) {
        profileCache.layouts = r.data.layouts;
        profileCache.loadedAt = Date.now();
      }
    } catch (e) {
      return api.sendMessage('❌ Không thể tải danh sách layouts từ server: ' + (e.message || ''), threadID, (err, info) => {});
    }
  }

  if (!profileCache.layouts.length) {
    return api.sendMessage('❌ Hiện tại không có mẫu profile nào.', threadID, (e, info) => {});
  }

  let msg = '🤖 LEGI STUDIO PROFILE BOT 🤖\n\n';
  msg += '🔹 Chọn Mẫu Profile Bạn Muốn 🔹\n';
  msg += '━━━━━━━━━━━━━━━━━━\n';
  profileCache.layouts.forEach((l, i) => {
    msg += `${i + 1}. ${l.layout}\n`;
  });
  msg += '━━━━━━━━━━━━━━━━━━\n\n';
  msg += 'ℹ️ Reply số thứ tự để chọn mẫu profile.';

  return api.sendMessage(msg, threadID, (err, info) => {
    userStep[senderID] = {
      step: 'chooseLayout',
      messageRefs: [info ? info.messageID : null],
      data: {},
      replyTo: messageID
    };
    scheduleExpiry(senderID);

    global.client.handleReply.push({
      name: module.exports.config.name,
      messageID: info ? info.messageID : null,
      author: senderID
    });
  });
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body, attachments } = event;
  if (!userStep[senderID]) return;
  const state = userStep[senderID];
  const input = (body || '').trim();

  async function sendPrompt(text, pushToRefs = true) {
    return new Promise((resolve) => {
      api.sendMessage(text, threadID, (err, info) => {
        if (info && pushToRefs) state.messageRefs.push(info.messageID);
        resolve(info);
      });
    });
  }

  function isYes(s) { if (!s) return false; s = s.toLowerCase(); return s === 'có' || s === 'co' || s === 'yes' || s === 'y' || s === 'true'; }
  function isNo(s) { if (!s) return false; s = s.toLowerCase(); return s === 'không' || s === 'khong' || s === 'ko' || s === 'no' || s === 'n' || s === 'false'; }

  try {
    if (state.step === 'chooseLayout') {
      const idx = parseInt(input, 10);
      if (isNaN(idx) || idx < 1 || idx > profileCache.layouts.length) {
        api.sendMessage('❌ Số không hợp lệ. Vui lòng reply lại số thứ tự trong menu.', threadID, (e, info) => {});
        return;
      }
      const selection = profileCache.layouts[idx - 1];
      state.data.layout = selection.layout;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên game\nví dụ: LEGI STUDIO');
      state.step = 'enterTengame';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterTengame') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập tên game hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.tengame = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên thật\nví dụ: Nguyễn Văn A');
      state.step = 'enterTenthat';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterTenthat') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập tên thật hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.tenthat = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập ngày sinh\nví dụ: 1/1/2000)');
      state.step = 'enterNgaysinh';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterNgaysinh') {
      if (!input || !/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
        api.sendMessage('❌ Định dạng ngày sinh không hợp lệ. Vui lòng nhập DD/MM/YYYY.', threadID, (e, info) => {});
        return;
      }
      state.data.ngaysinh = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên team\nví dụ: LEGI TEAM');
      state.step = 'enterTenteam';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterTenteam') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập tên team hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.tenteam = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên giải\nví dụ: LEGI SCRIM');
      state.step = 'enterTengiai';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterTengiai') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập tên giải hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.tengiai = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập vị trí\nCác vị trí hợp lệ: \nt=Tanker \ns=Sniper \nb=Bomber \nsp=Supports \nr=Rifler \nc=Coach');
      state.step = 'enterVitri';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterVitri') {
      const v = (input || '').toLowerCase();
      const validPos = ['t','s','b','sp','r','c'];
      if (!validPos.includes(v)) {
        api.sendMessage('❌ vitri không hợp lệ. Vị trí hợp lệ: t s b sp r c', threadID, (e, info) => {});
        return;
      }
      state.data.vitri = v;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên SÚNG 1');
      state.step = 'enterSung1';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterSung1') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập súng 1 hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.sung1 = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên SÚNG 2');
      state.step = 'enterSung2';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }
 
    if (state.step === 'enterSung2') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập súng 2 hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.sung2 = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];
 
      state.currentNhanvat = 1;
      const info = await sendPrompt('🔹 Vui lòng nhập NHÂN VẬT 1');
      state.step = 'enterNhanvat';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }
 
    if (state.step === 'enterNhanvat') {
      const idx = state.currentNhanvat || 1;
      if (!input) { api.sendMessage(`❌ Vui lòng nhập nhân vật ${idx} hợp lệ.`, threadID, (e, info) => {}); return; }
      state.data[`nhanvat${idx}`] = input;
 
      state.currentNhanvat = idx + 1;
      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      if (state.currentNhanvat <= 4) {
        const next = state.currentNhanvat;
        const info = await sendPrompt(`🔹 Vui lòng nhập NHÂN VẬT ${next})`);
        state.step = 'enterNhanvat';
        state.messageRefs = [info ? info.messageID : null];
        scheduleExpiry(senderID);
        global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
        return;
      }
 
      const info = await sendPrompt('📷 Bạn có muốn thêm LOGO TEAM không? (có/không)');
      state.step = 'askLogoTeam';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }
 
    if (state.step === 'askLogoTeam') {
      if (isYes(input)) {
        state.data.logoteam = true;
        for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
        state.messageRefs = [];
        const info = await sendPrompt('📷 Vui lòng reply tin nhắn này bằng ẢNH LOGO TEAM.');
        state.step = 'waitPngLogo';
        state.messageRefs = [info ? info.messageID : null];
        scheduleExpiry(senderID);
        global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
        return;
      }
      if (isNo(input)) {
        state.data.logoteam = false;
        for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
        state.messageRefs = [];
        const info = await sendPrompt('📷 Bạn có muốn thêm AVATAR không? (có/không)');
        state.step = 'askAvatar';
        state.messageRefs = [info ? info.messageID : null];
        scheduleExpiry(senderID);
        global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
        return;
      }
      api.sendMessage('❌ Vui lòng reply đúng "có" hoặc "không".', threadID, (e, info) => {});
      return;
    }
 
    if (state.step === 'waitPngLogo') {
      if (!attachments || !attachments.length || attachments[0].type !== 'photo') {
        api.sendMessage('❌ Vui lòng reply đúng ẢNH logo.', threadID, (e, info) => {});
        return;
      }

      const url = attachments[0].url;
      const tmpFile = path.join(TMP_ROOT, `${senderID}-team-logo-${Date.now()}.png`);
      try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        fs.writeFileSync(tmpFile, Buffer.from(resp.data));
        state.data.pnglogoteam = tmpFile;
      } catch (e) {
        api.sendMessage('❌ Lỗi tải ảnh logo: ' + (e.message || ''), threadID, (err, info) => {});
        return;
      }

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('📷 Bạn có muốn thêm AVATAR không? (có/không)');
      state.step = 'askAvatar';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }
 
    if (state.step === 'askAvatar') {
      if (isYes(input)) {
        state.data.avatar = true;
        for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
        state.messageRefs = [];
        const info = await sendPrompt('📷 Vui lòng reply tin nhắn này bằng ẢNH AVATAR.');
        state.step = 'waitPngAvatar';
        state.messageRefs = [info ? info.messageID : null];
        scheduleExpiry(senderID);
        global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
        return;
      } else if (isNo(input)) {
        state.data.avatar = false; 
        for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
        state.messageRefs = [];
        state.step = 'renderProfile';
      } else {
        api.sendMessage('❌ Vui lòng reply đúng "có" hoặc "không".', threadID, (e, info) => {});
        return;
      }
    }
 
    if (state.step === 'waitPngAvatar') {
      if (!attachments || !attachments.length || attachments[0].type !== 'photo') {
        api.sendMessage('❌ Vui lòng reply đúng ẢNH AVATAR.', threadID, (e, info) => {});
        return;
      }

      const url = attachments[0].url;
      const tmpFile = path.join(TMP_ROOT, `${senderID}-avatar-${Date.now()}.png`);
      try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        fs.writeFileSync(tmpFile, Buffer.from(resp.data));
        state.data.pngavatar = tmpFile;
      } catch (e) {
        api.sendMessage('❌ Lỗi tải ảnh avatar: ' + (e.message || ''), threadID, (err, info) => {});
        return;
      }

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      state.step = 'renderProfile';
    }
 
    if (state.step === 'renderProfile') {
      api.sendMessage(`⌛ Bắt đầu tiến trình tạo profile...`, threadID, (e, info) => {});

      try {
        const form = new FormData();
 
        const required = ['layout','tengame','tenthat','ngaysinh','tengiai','tenteam','vitri','sung1','sung2','nhanvat1','nhanvat2','nhanvat3','nhanvat4','avatar','logoteam'];
 
        form.append('layout', state.data.layout);
        form.append('tengame', state.data.tengame);
        form.append('tenthat', state.data.tenthat);
        form.append('ngaysinh', state.data.ngaysinh);
        form.append('tengiai', state.data.tengiai);
        form.append('tenteam', state.data.tenteam);
        form.append('vitri', state.data.vitri);
        form.append('sung1', state.data.sung1);
        form.append('sung2', state.data.sung2);
        form.append('nhanvat1', state.data.nhanvat1);
        form.append('nhanvat2', state.data.nhanvat2);
        form.append('nhanvat3', state.data.nhanvat3);
        form.append('nhanvat4', state.data.nhanvat4);
 
        form.append('avatar', state.data.avatar ? 'true' : 'false');
        form.append('logoteam', state.data.logoteam ? 'true' : 'false');
 
        if (state.data.pnglogoteam) {
          form.append('pnglogoteam', fs.createReadStream(state.data.pnglogoteam), { filename: 'pnglogoteam.png' });
        }

        if (state.data.pngavatar) {
          form.append('pngavatar', fs.createReadStream(state.data.pngavatar), { filename: 'pngavatar.png' });
        }

        const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/profile`;
        const headers = Object.assign({}, form.getHeaders());
        if (API_KEY) headers['x-bot-key'] = API_KEY;

        const resp = await axios.post(url, form, {
          headers,
          responseType: 'json',
          maxContentLength: 50 * 1024 * 1024,
          timeout: 120000
        });
 
        if (!resp.data || !resp.data.success) {
          const msg = resp.data && resp.data.message ? resp.data.message : 'API trả về lỗi không rõ';
          throw new Error(String(msg));
        }

        const imageBase64 = resp.data.imageBase64 || resp.data.imageBase64 || resp.data.imageBase64; 
        if (!imageBase64 || !imageBase64.startsWith('data:image')) {
          throw new Error('API trả về không đúng imageBase64');
        }
 
        const base64 = imageBase64.split(',')[1];
        const outFile = path.join(TMP_ROOT, `${senderID}-profile-${Date.now()}.png`);
        fs.writeFileSync(outFile, Buffer.from(base64, 'base64'));

        await new Promise((resolve) => {
          api.sendMessage({ body: `✅ Đã tạo profile thành công`, attachment: fs.createReadStream(outFile) }, threadID, (err, info) => {
            resolve();
          });
        });
 
        try { fs.unlinkSync(outFile); } catch (e) {}
        if (state.data.pnglogoteam) try { fs.unlinkSync(state.data.pnglogoteam); } catch (e) {}
        if (state.data.pngavatar) try { fs.unlinkSync(state.data.pngavatar); } catch (e) {}

        if (state.expiryTimer) clearTimeout(state.expiryTimer);
        delete userStep[senderID];
        return;

      } catch (e) {
        console.error('[Profile] Lỗi khi render profile', e.message || e);
        api.sendMessage('❌ Lỗi khi render profile: ' + (e.message || ''), threadID, (err, info) => {});
        if (state.expiryTimer) clearTimeout(state.expiryTimer); 
        try { if (state.data.pnglogoteam) fs.unlinkSync(state.data.pnglogoteam); } catch (er) {}
        try { if (state.data.pngavatar) fs.unlinkSync(state.data.pngavatar); } catch (er) {}
        delete userStep[senderID];
        return;
      }
    }

  } catch (err) {
    console.error('[Profile] handleReply unexpected error', err);
    try { api.sendMessage('❌ Lỗi nội bộ module profileff: ' + (err.message || ''), threadID, (e, info) => {}); } catch (e) {}
  }
};

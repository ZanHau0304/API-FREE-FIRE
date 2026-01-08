////////////////////////////////////////////////////////////
//         MODULES MẪU SỬ DỤNG API KEY CỦA LINEUP         //
////////////////////////////////////////////////////////////

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const SERVER_URL = process.env.API_URL || 'https://legistudio.site';
const API_KEY = process.env.API_KEY || 'API_KEY'; //thay api key của bạn vào đây 

const TMP_ROOT = path.join(__dirname, 'cache', 'lineup_tmp');
fs.ensureDirSync(TMP_ROOT);

let lineupCache = {
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
    if (!API_KEY) return; //console.warn('[Lineup] Không tìm thấy API_KEY');
    const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/lineup/layouts?apikey=${encodeURIComponent(API_KEY)}`;
    const r = await axios.get(url, { timeout: 15000 });
    if (r.data && Array.isArray(r.data.layouts)) {
      lineupCache.layouts = r.data.layouts;
      lineupCache.loadedAt = Date.now();
      //console.log(`[Lineup] Ghi nhận thành công ${lineupCache.layouts.length} layouts`);
    }
  } catch (e) {
    //console.warn('[lineup] Không thể load layouts:', e.message || e);
  }
})();

async function tryUnsend(api, threadID, messageID) {
  if (!messageID) return;
  try { await api.unsendMessage(messageID); } catch (e) {}
}

module.exports.config = {
  name: 'lineupff',
  version: '1.0',
  hasPermssion: 2, // đặt thành 0 nếu Permssion user = 0
  Rent: 1,
  credits: 'Dev by LEGI STUDIO - ZanHau',
  description: 'Basic Modules Tạo Lineup Qua API',
  commandCategory: 'Tính Điểm',
  usages: '.lineupff',
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  if (!lineupCache.layouts || !lineupCache.layouts.length) {
    if (!API_KEY) return api.sendMessage('❌ Server chưa cấu hình API KEY. Vui lòng liên hệ admin.', threadID, (e, info) => {});
    try {
      const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/lineup/layouts?apikey=${encodeURIComponent(API_KEY)}`;
      const r = await axios.get(url, { timeout: 15000 });
      if (r.data && Array.isArray(r.data.layouts)) {
        lineupCache.layouts = r.data.layouts;
        lineupCache.loadedAt = Date.now();
      }
    } catch (e) {
      return api.sendMessage('❌ Không thể tải danh sách layouts từ server: ' + (e.message || ''), threadID, (err, info) => {});
    }
  }

  if (!lineupCache.layouts.length) {
    return api.sendMessage('❌ Hiện tại không có mẫu lineup nào.', threadID, (e, info) => {});
  }

  let msg = '🤖 LEGI STUDIO LINEUP BOT 🤖\n\n';
  msg += '🔹 Chọn Mẫu Lineup Bạn Muốn 🔹\n';
  msg += '━━━━━━━━━━━━━━━━━━\n';
  lineupCache.layouts.forEach((l, i) => {
    msg += `${i + 1}. ${l.layout}\n`;
  });
  msg += '━━━━━━━━━━━━━━━━━━\n\n';
  msg += 'ℹ️ Reply số thứ tự để chọn mẫu lineup.';

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
      if (isNaN(idx) || idx < 1 || idx > lineupCache.layouts.length) {
        api.sendMessage('❌ Số không hợp lệ. Vui lòng reply lại số thứ tự trong menu.', threadID, (e, info) => {});
        return;
      }
      const selection = lineupCache.layouts[idx - 1];
      state.data.layout = selection.layout;
      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      let txt = '🔹 Vui lòng chọn số lượng thành viên:\n\n';
      const nums = selection.nums || [];
      nums.forEach((n, i) => txt += `${i + 1}. ${n} thành viên\n`);
      txt += '\nℹ️ Reply số thứ tự để chọn.';

      const info = await sendPrompt(txt);
      state.step = 'chooseNum';
      state.selectionNums = nums;
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'chooseNum') {
      const idx = parseInt(input, 10);
      const nums = state.selectionNums || [];
      if (isNaN(idx) || idx < 1 || idx > nums.length) {
        api.sendMessage('❌ Số không hợp lệ. Vui lòng reply lại số thứ tự trong menu.', threadID, (e, info) => {});
        return;
      }
      state.data.num = parseInt(nums[idx - 1], 10);

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên team');
      state.step = 'enterTeam';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterTeam') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập tên team hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.team = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('🔹 Vui lòng nhập tên giải đấu');
      state.step = 'enterTengiai';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterTengiai') {
      if (!input) { api.sendMessage('❌ Vui lòng nhập tên giải đấu hợp lệ.', threadID, (e, info) => {}); return; }
      state.data.tengiai = input;

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      const info = await sendPrompt('📷 Bạn có muốn thêm logo cho đội không? (có/không)');
      state.step = 'askLogo';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'askLogo') {
      if (isYes(input)) {
        state.data.logoteam = true;
        for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
        state.messageRefs = [];
        const info = await sendPrompt('📷 Vui lòng reply tin nhắn này bằng ảnh logo.');
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
        const info = await sendPrompt('📷 Bạn có muốn thêm avatar cho thành viên không? (có/không)');
        state.step = 'askAvatarAll';
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

      const info = await sendPrompt('📷 Bạn có muốn thêm avatar cho thành viên không? (có/không)');
      state.step = 'askAvatarAll';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'askAvatarAll') {
      if (isYes(input)) {
        state.data.avatarAll = true;
      } else if (isNo(input)) {
        state.data.avatarAll = false;
      } else {
        api.sendMessage('❌ Vui lòng reply đúng "có" hoặc "không".', threadID, (e, info) => {});
        return;
      }

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      state.data.players = [];
      state.currentPlayer = 1;

      const info = await sendPrompt(`🔹 Vui lòng nhập thông tin thành viên 1 (VD: Nguyễn A, t)\n\nVị trí hợp lệ:\nt=Tanker \ns=Sniper \nb=Bomber \nsp=Supports \nr=Rifler \nc=Coach`);
      state.step = 'enterPlayer';
      state.messageRefs = [info ? info.messageID : null];
      scheduleExpiry(senderID);
      global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
      return;
    }

    if (state.step === 'enterPlayer') {
      const i = state.currentPlayer;
      if (!input) { api.sendMessage('❌ Vui lòng nhập thông tin thành viên theo định dạng: Tên, vị trí', threadID, (e, info) => {}); return; }

      const parts = input.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) { api.sendMessage('❌ Định dạng sai. VD: Nguyễn A, t', threadID, (e, info) => {}); return; }
      const name = parts.slice(0, parts.length - 1).join(', ');
      const pos = parts[parts.length - 1].toLowerCase();
      const validPos = ['t','s','b','sp','r','c'];

      if (!validPos.includes(pos)) {
        api.sendMessage('❌ Vị trí không hợp lệ. Vị trí hợp lệ: t s b sp r c', threadID, (e, info) => {});
        return;
      }

      state.data.players[i - 1] = { name, pos };

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];

      if (state.data.avatarAll === false) {
        state.data.players[i - 1].pngavatar = 'none';
        state.currentPlayer += 1;

        if (state.currentPlayer <= state.data.num) {
          const next = state.currentPlayer;
          api.sendMessage(
            `🔹 Vui lòng nhập thông tin thành viên ${next} (VD: Nguyễn A, t)\n\nVị trí hợp lệ:\nt=Tanker \ns=Sniper \nb=Bomber \nsp=Supports \nr=Rifler \nc=Coach`,
            threadID,
            (e, info) => {
              if (info) {
                state.messageRefs.push(info.messageID);
                state.step = 'enterPlayer';
                global.client.handleReply.push({ name: module.exports.config.name, messageID: info.messageID, author: senderID });
              }
            }
          );
          scheduleExpiry(senderID);
          return;
        }

        state.step = 'renderLineup';
      } else {
        const info = await sendPrompt(`📷 Vui lòng reply tin nhắn này ảnh thành viên ${i} hoặc nhập "không" để bỏ qua.`);
        state.step = 'waitPngAvatar';
        state.messageRefs = [info ? info.messageID : null];
        scheduleExpiry(senderID);
        global.client.handleReply.push({ name: module.exports.config.name, messageID: info ? info.messageID : null, author: senderID });
        return;
      }
    }

    if (state.step === 'renderLineup') {
      api.sendMessage(`⌛ Bắt đầu tiến trình tạo lineup team ${state.data.team}...`, threadID, (e, info) => {});

      try {
        const form = new FormData();
        form.append('layout', state.data.layout);
        form.append('num', String(state.data.num));
        form.append('team', state.data.team);
        form.append('tengiai', state.data.tengiai);
        form.append('logoteam', String(Boolean(state.data.logoteam)));

        for (let k = 1; k <= state.data.num; k++) {
          const p = state.data.players[k - 1] || { name: '', pos: '' };
          form.append(`player${k}_name`, p.name);
          form.append(`player${k}_pos`, p.pos);
          form.append(`avatar${k}`, state.data.avatarAll ? 'true' : 'false');

          if (p.pngavatar && p.pngavatar !== 'none') {
            form.append(`pngavatar${k}`, fs.createReadStream(p.pngavatar), { filename: `avatar${k}.png` });
          } else {
            form.append(`pngavatar${k}`, 'none');
          }
        }

        if (state.data.pnglogoteam) {
          form.append('pnglogoteam', fs.createReadStream(state.data.pnglogoteam), { filename: 'team_logo.png' });
        }

        form.append('avatarAll', state.data.avatarAll ? 'true' : 'false');

        const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/lineup`;
        const headers = Object.assign({}, form.getHeaders());
        if (API_KEY) headers['x-bot-key'] = API_KEY;

        const resp = await axios.post(url, form, { headers, responseType: 'arraybuffer', maxContentLength: 50 * 1024 * 1024, timeout: 120000 });

        const contentType = resp.headers['content-type'] || '';
        if (!contentType.includes('image')) {
          let txt = resp.data.toString ? resp.data.toString('utf8') : '';
          try { txt = JSON.parse(txt); } catch (e) {}
          throw new Error('API trả về không phải ảnh: ' + (typeof txt === 'string' ? txt : JSON.stringify(txt)));
        }

        const outFile = path.join(TMP_ROOT, `${senderID}-lineup-${Date.now()}.png`);
        fs.writeFileSync(outFile, Buffer.from(resp.data));

        await new Promise((resolve) => {
          api.sendMessage({ body: `✅Đã tạo ảnh lineup thành công\nTEAM: ${state.data.team}`, attachment: fs.createReadStream(outFile) }, threadID, (err, info) => {
            resolve();
          });
        });

        try { fs.unlinkSync(outFile); } catch (e) {}
        if (state.data.pnglogoteam) try { fs.unlinkSync(state.data.pnglogoteam); } catch (e) {}
        for (const p of state.data.players || []) { if (p.pngavatar && p.pngavatar !== 'none') try { fs.unlinkSync(p.pngavatar); } catch (e) {} }

        if (state.expiryTimer) clearTimeout(state.expiryTimer);
        delete userStep[senderID];
        return;

      } catch (e) {
        console.error('[Lineup] Lỗi khi render lineup', e.message || e);
        api.sendMessage('❌ Lỗi khi render lineup: ' + (e.message || ''), threadID, (err, info) => {});
        if (state.expiryTimer) clearTimeout(state.expiryTimer);
        delete userStep[senderID];
        return;
      }
    }

    if (state.step === 'waitPngAvatar') {
      const i = state.currentPlayer;

      if (!state.data.players[i - 1]) state.data.players[i - 1] = { name: '', pos: '' };

      if (isNo(input) || input.toLowerCase() === 'không' || input.toLowerCase() === 'khong') {
        state.data.players[i - 1].pngavatar = 'none';
      } else if (attachments && attachments.length && attachments[0].type === 'photo') {

        const url = attachments[0].url;
        const tmpFile = path.join(TMP_ROOT, `${senderID}-avatar-${i}-${Date.now()}.png`);
        try {
          const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
          fs.writeFileSync(tmpFile, Buffer.from(resp.data));
          state.data.players[i - 1].pngavatar = tmpFile;
        } catch (e) {
          api.sendMessage('❌ Lỗi tải ảnh avatar: ' + (e.message || ''), threadID, (err, info) => {});
          return;
        }
      } else {
        api.sendMessage('❌ Vui lòng reply đúng ẢNH hoặc nhập "không" để bỏ qua.', threadID, (e, info) => {});
        return;
      }

      state.currentPlayer += 1;

      if (state.currentPlayer <= state.data.num) {
        for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
        state.messageRefs = [];
        const next = state.currentPlayer;
        api.sendMessage(
          `🔹 Vui lòng nhập thông tin thành viên ${next} (VD: Nguyễn A, t)\n\nVị trí hợp lệ:\nt=Tanker \ns=Sniper \nb=Bomber \nsp=Supports \nr=Rifler \nc=Coach`,
          threadID,
          (e, info) => {
            if (info) {
              state.messageRefs.push(info.messageID);
              state.step = 'enterPlayer';
              global.client.handleReply.push({ name: module.exports.config.name, messageID: info.messageID, author: senderID });
            }
          }
        );
        scheduleExpiry(senderID);
        return;
      }

      for (const mid of state.messageRefs || []) { tryUnsend(api, threadID, mid); }
      state.messageRefs = [];
      state.step = 'renderLineup';

      api.sendMessage(`⌛ Bắt đầu tiến trình tạo lineup team ${state.data.team}...`, threadID, (e, info) => {});

      try {
        const form = new FormData();
        form.append('layout', state.data.layout);
        form.append('num', String(state.data.num));
        form.append('team', state.data.team);
        form.append('tengiai', state.data.tengiai);
        form.append('logoteam', String(Boolean(state.data.logoteam)));

        for (let k = 1; k <= state.data.num; k++) {
          const p = state.data.players[k - 1] || { name: '', pos: '' };
          form.append(`player${k}_name`, p.name);
          form.append(`player${k}_pos`, p.pos);
          form.append(`avatar${k}`, state.data.avatarAll ? 'true' : 'false');

          if (p.pngavatar && p.pngavatar !== 'none') {
            form.append(`pngavatar${k}`, fs.createReadStream(p.pngavatar), { filename: `avatar${k}.png` });
          } else {
            form.append(`pngavatar${k}`, 'none');
          }
        }

        if (state.data.pnglogoteam) {
          form.append('pnglogoteam', fs.createReadStream(state.data.pnglogoteam), { filename: 'team_logo.png' });
        }

        form.append('avatarAll', state.data.avatarAll ? 'true' : 'false');

        const url = `${SERVER_URL.replace(/\/$/, '')}/api-legi/lineup`;
        const headers = Object.assign({}, form.getHeaders());
        if (API_KEY) headers['x-bot-key'] = API_KEY;

        const resp = await axios.post(url, form, { headers, responseType: 'arraybuffer', maxContentLength: 50 * 1024 * 1024, timeout: 120000 });

        const contentType = resp.headers['content-type'] || '';
        if (!contentType.includes('image')) {
          let txt = resp.data.toString ? resp.data.toString('utf8') : '';
          try { txt = JSON.parse(txt); } catch (e) {}
          throw new Error('API trả về không phải ảnh: ' + (typeof txt === 'string' ? txt : JSON.stringify(txt)));
        }

        const outFile = path.join(TMP_ROOT, `${senderID}-lineup-${Date.now()}.png`);
        fs.writeFileSync(outFile, Buffer.from(resp.data));

        await new Promise((resolve) => {
          api.sendMessage({ body: `✅Đã tạo ảnh lineup thành công\nTEAM: ${state.data.team}`, attachment: fs.createReadStream(outFile) }, threadID, (err, info) => {
            resolve();
          });
        });

        try { fs.unlinkSync(outFile); } catch (e) {}
        if (state.data.pnglogoteam) try { fs.unlinkSync(state.data.pnglogoteam); } catch (e) {}
        for (const p of state.data.players || []) { if (p.pngavatar && p.pngavatar !== 'none') try { fs.unlinkSync(p.pngavatar); } catch (e) {} }

        if (state.expiryTimer) clearTimeout(state.expiryTimer);
        delete userStep[senderID];
        return;

      } catch (e) {
        console.error('[Lineup] Lỗi khi render lineup', e.message || e);
        api.sendMessage('❌ Lỗi khi render lineup: ' + (e.message || ''), threadID, (err, info) => {});
        if (state.expiryTimer) clearTimeout(state.expiryTimer);
        delete userStep[senderID];
        return;
      }
    }

  } catch (err) {
    console.error('[Lineup] Lỗi khi render lineup', err);
    try { api.sendMessage('❌ Lỗi khi render lineup: ' + (err.message || ''), threadID, (e, info) => {}); } catch (e) {}
  }
};

import { serverTimeOffset } from './dataService';
import { elapsedClock as rawElapsedClock, normalizeKickoff } from '../../shared/tournament.js';
export { numberMatchesBySchedule, calculateGroupStandings, isGroupStageFinished, getQualifyingCount, calculateEventsGoals, formatMatchMinute, formatSecondsToMMSS, generateKnockoutPairs, getTopScorers, getDisciplineStats, detectViolations, generateRoundRobinMatches, parseMatchMinute, compareEvents, resolveWinner, evaluateShootout, validatePlayers, playerKey, mergeMatchDraft, normalizeKickoff, kickoffInput } from '../../shared/tournament.js';

/**
 * Định dạng hiển thị tên cầu thủ sạch đẹp (tách số áo nếu có dạng "10 - Tên Cầu Thủ")
 */
export function cleanPlayerName(raw = '') {
  if (!raw) return '';
  const match = raw.match(/^\d+\s*-\s*(.+)$/);
  return match ? match[1] : raw;
}

/**
 * Lấy số áo từ chuỗi tên "10 - Nguyễn Văn A"
 */
export function getPlayerNumber(raw = '') {
  if (!raw) return '';
  const match = raw.match(/^(\d+)\s*-\s*.+$/);
  return match ? match[1] : '';
}

/**
 * Format ngày giờ theo phong cách Việt Nam
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return 'Chưa xếp giờ';
  try {
    const d = new Date(normalizeKickoff(dateStr));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('vi-VN', {
      timeZone:'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Nén và chuyển đổi file ảnh sang chuỗi Data URL (Base64 JPEG) kích thước chuẩn Avatar 180x180
 * Tự động cắt vuông theo tâm (center crop) để ảnh không bị méo.
 * @param {File} file File ảnh từ máy hoặc điện thoại
 * @param {number} targetSize Kích thước vuông tối đa (mặc định 180px)
 * @param {number} quality Chất lượng nén (0.82 cho dung lượng ~10-15KB siêu nhẹ)
 * @returns {Promise<string>}
 */
export function compressAvatarImage(file, targetSize = 180, quality = 0.82, crop = {}) {
  return new Promise((resolve, reject) => {
    if (!file || file.size > 12e6 || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      reject(new Error('Vui lòng chọn một file hình ảnh hợp lệ (JPG, PNG, WebP)!'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.width;
        const height = img.height;

        // Cắt vuông tâm
        if (!width || !height || width * height > 25000000) { reject(new Error('Ảnh vượt 25 megapixel hoặc không hợp lệ.')); return; }
        const minDim = Math.min(width, height) / Math.max(1, Math.min(3, crop.zoom || 1));
        const startX = (width - minDim) * ((crop.x ?? 50) / 100);
        const startY = (height - minDim) * ((crop.y ?? 50) / 100);

        const size = Math.min(minDim, targetSize);
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Thiết bị không hỗ trợ xử lý ảnh.')); return; }
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          img,
          startX,
          startY,
          minDim,
          minDim,
          0,
          0,
          size,
          size
        );

        let q = quality, dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > 80000 && q > 0.4) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q); }
        if (dataUrl.length > 80000) { reject(new Error('Không nén được ảnh xuống dung lượng phù hợp.')); return; }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không thể đọc định dạng ảnh này!'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file từ thiết bị!'));
    reader.readAsDataURL(file);
  });
}

export async function rotateAvatarFile(file) {
  if(!file||file.size>12e6||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Chọn ảnh JPG, PNG hoặc WebP dưới 12 MB.');
  const url=URL.createObjectURL(file);
  try {
    const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Không đọc được ảnh.'));image.src=url;});
    if(!img.width||!img.height||img.width*img.height>25000000)throw new Error('Ảnh vượt 25 megapixel.');
    const scale=Math.min(1,1600/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.height*scale);canvas.height=Math.round(img.width*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Thiết bị không hỗ trợ xoay ảnh.');ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(img,0,0,img.width*scale,img.height*scale);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Không xoay được ảnh.');return new File([blob],'avatar-rotated.png',{type:'image/png'});
  } finally { URL.revokeObjectURL(url); }
}

export function elapsedClock(clock={},now=Date.now()){return rawElapsedClock(clock,clock.timeBasis==='server'?now+serverTimeOffset():now);}

import { Command } from "../types";
import config from "../config";
import { logger } from "../utils/logger";
import fs from "fs-extra";
import path from "path";
import ytdl from "ytdl-core";
import axios from 'axios';

// Thư mục lưu file tải về
const DOWNLOAD_DIR = "downloads";
fs.ensureDirSync(DOWNLOAD_DIR);

export const download: Command = {
  name: "download",
  description: "Tải video từ YouTube hoặc các trang web khác",
  usage: `${config.prefix}download <link>`,
  execute: async (api, event) => {
    const link = event.body.slice(config.prefix.length + 9).trim();
    if (!link) {
      await api.sendMessage("❌ Vui lòng nhập link cần tải!", event.threadID);
      return;
    }

    try {
      await api.sendMessage("⏳ Đang xử lý yêu cầu tải video...", event.threadID);

      // Kiểm tra xem có phải link YouTube không
      const isYouTube = ytdl.validateURL(link);

      if (isYouTube) {
        // Lấy thông tin video
        const info = await ytdl.getInfo(link);
        const videoTitle = info.videoDetails.title;
        const videoLength = parseInt(info.videoDetails.lengthSeconds);

        // Kiểm tra độ dài video
        if (videoLength > 600) {
          await api.sendMessage("❌ Video quá dài! Vui lòng chọn video ngắn hơn 10 phút.", event.threadID);
          return;
        }

        // Tạo tên file duy nhất
        const fileName = `${Date.now()}_${path.basename(videoTitle)}.mp4`;
        const filePath = path.join(DOWNLOAD_DIR, fileName);

        // Tải video
        await new Promise((resolve, reject) => {
          ytdl(link, {
            quality: 'lowest'
          })
          .pipe(fs.createWriteStream(filePath))
          .on('finish', resolve)
          .on('error', reject);
        });

        // Gửi video
        await api.sendMessage(
          {
            body: `🎥 ${videoTitle}`,
            attachment: fs.createReadStream(filePath)
          },
          event.threadID
        );

        // Xóa file sau khi gửi
        fs.unlink(filePath).catch(err => {
          const error = new Error("Failed to delete video file");
          error.name = "FileCleanupError";
          logger.error("Lỗi xóa file video", error);
        });

      } else {
        // TODO: Thêm hỗ trợ tải từ các trang khác
        await api.sendMessage("❌ Hiện tại chỉ hỗ trợ tải video từ YouTube.", event.threadID);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = 'VideoDownloadError';
      logger.error("Lỗi khi tải video", err);
      await api.sendMessage("❌ Không thể tải video. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const video: Command = {
  name: "video",
  description: "Phát video từ YouTube",
  usage: `${config.prefix}video <link hoặc từ khóa>`,
  execute: async (api, event) => {
    const query = event.body.slice(config.prefix.length + 6).trim();
    if (!query) {
      await api.sendMessage("❌ Vui lòng nhập link hoặc từ khóa tìm kiếm!", event.threadID);
      return;
    }

    try {
      await api.sendMessage("⏳ Đang xử lý yêu cầu video...", event.threadID);

      // Kiểm tra xem có phải là YouTube URL không
      const isValidUrl = ytdl.validateURL(query);

      if (!isValidUrl) {
        const error = new Error("Invalid YouTube URL");
        error.name = "InvalidURLError";
        throw error;
      }

      // Lấy thông tin video
      const info = await ytdl.getInfo(query);
      const videoTitle = info.videoDetails.title;
      const videoLength = parseInt(info.videoDetails.lengthSeconds);

      // Kiểm tra độ dài video
      if (videoLength > 600) { // Giới hạn 10 phút
        await api.sendMessage("❌ Video quá dài! Vui lòng chọn video ngắn hơn 10 phút.", event.threadID);
        return;
      }

      // Tạo tên file duy nhất
      const fileName = `${Date.now()}_${path.basename(videoTitle)}.mp4`;
      const filePath = path.join(DOWNLOAD_DIR, fileName);

      // Tải video
      await new Promise((resolve, reject) => {
        ytdl(query, {
          quality: 'lowest' // Chọn chất lượng thấp để tải nhanh hơn
        })
        .pipe(fs.createWriteStream(filePath))
        .on('finish', resolve)
        .on('error', reject);
      });

      // Gửi video
      await api.sendMessage(
        {
          body: `🎥 ${videoTitle}`,
          attachment: fs.createReadStream(filePath)
        },
        event.threadID
      );

      // Xóa file sau khi gửi
      fs.unlink(filePath).catch(err => {
        const error = new Error("Failed to delete video file");
        error.name = "FileCleanupError";
        logger.error("Lỗi xóa file video", error);
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = err.name || 'VideoCommandError';
      logger.error("Lỗi lệnh video", err);
      await api.sendMessage("❌ Không thể tải video. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const img: Command = {
  name: "img",
  description: "Tải ảnh từ link hoặc tìm kiếm",
  usage: `${config.prefix}img <link/từ khoá>`,
  execute: async (api, event) => {
    const query = event.body.slice(config.prefix.length + 4).trim();
    if (!query) {
      await api.sendMessage("❌ Vui lòng nhập link hoặc từ khóa tìm kiếm!", event.threadID);
      return;
    }

    try {
      await api.sendMessage("🔍 Đang tìm kiếm ảnh...", event.threadID);

      // TODO: Implement image search/download
      await api.sendMessage("🖼️ Tính năng tải ảnh đang được phát triển!", event.threadID);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = 'ImageCommandError';
      logger.error("Lỗi lệnh img", err);
      await api.sendMessage("❌ Không thể tải ảnh. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const meme: Command = {
  name: "meme",
  description: "Xem ảnh meme ngẫu nhiên",
  usage: `${config.prefix}meme`,
  execute: async (api, event) => {
    try {
      await api.sendMessage("🎭 Đang tìm meme hay...", event.threadID);

      try {
        // Gọi Reddit API để lấy meme ngẫu nhiên từ r/memes
        const response = await axios.get('https://www.reddit.com/r/memes/random.json');
        const memeData = response.data[0].data.children[0].data;
        const memeUrl = memeData.url;
        const memeTitle = memeData.title;

        // Tải và lưu ảnh
        const fileName = `${Date.now()}_meme.jpg`;
        const filePath = path.join(DOWNLOAD_DIR, fileName);

        const imageResponse = await axios({
          method: 'GET',
          url: memeUrl,
          responseType: 'stream'
        });

        await new Promise((resolve, reject) => {
          imageResponse.data
            .pipe(fs.createWriteStream(filePath))
            .on('finish', resolve)
            .on('error', reject);
        });

        // Gửi meme
        await api.sendMessage(
          {
            body: `😂 ${memeTitle}`,
            attachment: fs.createReadStream(filePath)
          },
          event.threadID
        );

        // Xóa file sau khi gửi
        fs.unlink(filePath).catch(err => {
          const error = new Error("Failed to delete meme file");
          error.name = "FileCleanupError";
          logger.error("Lỗi xóa file meme", error);
        });

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        err.name = 'MemeDownloadError';
        logger.error("Lỗi tải meme", err);
        await api.sendMessage("❌ Không thể tải meme. Thử lại sau nhé!", event.threadID);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = 'MemeCommandError';
      logger.error("Lỗi lệnh meme", err);
      await api.sendMessage("❌ Không thể tải meme. Vui lòng thử lại sau.", event.threadID);
    }
  }
};

export const commands = [video, img, meme, download];
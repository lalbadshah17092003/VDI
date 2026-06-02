const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const morgan = require('morgan');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// ✅ FIXED: Single CORS middleware
// ============================================
app.use(cors({
    origin: '*', // For now, allow all
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Temp directory for downloads
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Clean old temp files (older than 1 hour)
setInterval(() => {
    fs.readdir(TEMP_DIR, (err, files) => {
        if (err) return;
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(TEMP_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > 3600000) { // 1 hour
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 1800000); // Every 30 minutes

// ============================================
// ✅ ADDED: Root route (fixes 404 error)
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "🎥 Video Downloader API is running!",
        status: "active",
        endpoints: {
            "Get video info": "POST /api/video-info",
            "Download video": "POST /api/download",
            "Stream video": "GET /api/download-stream",
            "Health check": "GET /api/health"
        },
        note: "Send POST requests with { url: 'video_url' }",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// EXECUTE COMMAND HELPER
// ============================================
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { 
            maxBuffer: 1024 * 1024 * 50, // 50MB buffer
            timeout: 300000 // 5 minutes timeout
        }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                resolve(stdout);
            }
        });
    });
}

// ============================================
// VIDEO INFO ENDPOINT
// ============================================
app.post('/api/video-info', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL is required' 
            });
        }

        console.log('📥 Fetching info for:', url);

        // Check if yt-dlp is available
        try {
            await executeCommand('yt-dlp --version');
        } catch (e) {
            return res.status(500).json({
                success: false,
                error: 'yt-dlp is not installed on server. Contact administrator.',
                fix: 'Install yt-dlp: https://github.com/yt-dlp/yt-dlp#installation'
            });
        }

        // YouTube - Use yt-dlp
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
                const command = `yt-dlp --dump-json --no-playlist --no-warnings "${url}"`;
                console.log('Running:', command);
                
                const stdout = await executeCommand(command);
                const info = JSON.parse(stdout);
                
                console.log('✅ Got info for:', info.title);

                const videoInfo = {
                    success: true,
                    platform: 'youtube',
                    videoId: info.id,
                    title: info.title,
                    thumbnail: info.thumbnail,
                    duration: formatDuration(info.duration || 0),
                    durationSeconds: info.duration || 0,
                    author: info.uploader || info.channel || 'Unknown',
                    views: info.view_count || 0,
                    description: info.description ? 
                        info.description.substring(0, 300) + '...' : '',
                    formats: []
                };

                if (info.formats && info.formats.length > 0) {
                    const seen = new Set();
                    videoInfo.formats = info.formats
                        .filter(f => {
                            if (f.vcodec === 'none' && f.acodec === 'none') return false;
                            const key = `${f.format_note}_${f.ext}_${f.filesize}`;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        })
                        .map(f => ({
                            format_id: f.format_id,
                            quality: f.format_note || f.resolution || 'unknown',
                            ext: f.ext,
                            filesize: f.filesize ? 
                                (f.filesize / (1024 * 1024)).toFixed(2) + ' MB' : 
                                'Unknown size',
                            vcodec: f.vcodec,
                            acodec: f.acodec,
                            tbr: f.tbr,
                            fps: f.fps
                        }))
                        .slice(0, 20);
                }

                return res.json(videoInfo);

            } catch (ytError) {
                console.error('❌ yt-dlp error:', ytError);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Failed to fetch video. The video might be private or unavailable.' 
                });
            }
        }

        // Instagram
        else if (url.includes('instagram.com')) {
            try {
                try {
                    const command = `yt-dlp --dump-json --no-playlist "${url}"`;
                    const stdout = await executeCommand(command);
                    const info = JSON.parse(stdout);
                    
                    return res.json({
                        success: true,
                        platform: 'instagram',
                        title: info.title || 'Instagram Content',
                        thumbnail: info.thumbnail,
                        duration: info.duration ? formatDuration(info.duration) : 'N/A',
                        url: info.url || info.webpage_url,
                        formats: [{
                            format_id: 'best',
                            quality: 'Best Quality',
                            ext: 'mp4',
                            filesize: info.filesize ? 
                                (info.filesize / (1024 * 1024)).toFixed(2) + ' MB' : 
                                'Unknown'
                        }]
                    });
                } catch (e) {
                    console.log('yt-dlp failed for Instagram, trying web scraping...');
                }

                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000
                });

                const $ = cheerio.load(response.data);
                const videoUrl = $('meta[property="og:video"]').attr('content');
                const imageUrl = $('meta[property="og:image"]').attr('content');
                const title = $('meta[property="og:title"]').attr('content') || 'Instagram Content';

                if (videoUrl || imageUrl) {
                    return res.json({
                        success: true,
                        platform: 'instagram',
                        title,
                        thumbnail: imageUrl,
                        type: videoUrl ? 'video' : 'image',
                        url: videoUrl || imageUrl,
                        formats: [{
                            format_id: 'original',
                            quality: 'Original',
                            ext: videoUrl ? 'mp4' : 'jpg',
                            url: videoUrl || imageUrl
                        }]
                    });
                }

                return res.status(400).json({ 
                    success: false, 
                    error: 'Could not find media. Post might be private.' 
                });
            } catch (igError) {
                console.error('Instagram error:', igError);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Failed to fetch Instagram content.' 
                });
            }
        }

        // Other platforms
        else {
            try {
                const command = `yt-dlp --dump-json --no-playlist "${url}"`;
                const stdout = await executeCommand(command);
                const info = JSON.parse(stdout);
                
                return res.json({
                    success: true,
                    platform: info.extractor_key?.toLowerCase() || 'direct',
                    title: info.title || 'Video',
                    thumbnail: info.thumbnail,
                    duration: info.duration ? formatDuration(info.duration) : 'N/A',
                    formats: [{
                        format_id: 'best',
                        quality: 'Best Quality',
                        ext: info.ext || 'mp4',
                        filesize: info.filesize ? 
                            (info.filesize / (1024 * 1024)).toFixed(2) + ' MB' : 
                            'Unknown'
                    }]
                });
            } catch (e) {
                return res.json({
                    success: true,
                    platform: 'direct',
                    title: 'Direct Download',
                    formats: [{
                        format_id: 'original',
                        quality: 'Original',
                        ext: 'mp4'
                    }]
                });
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error: ' + error.message 
        });
    }
});

// ============================================
// DOWNLOAD ENDPOINT
// ============================================
app.post('/api/download', async (req, res) => {
    try {
        const { url, format_id } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL is required' 
            });
        }

        console.log('⬇️ Downloading:', url);

        const videoId = uuidv4();
        const outputPath = path.join(TEMP_DIR, `${videoId}.%(ext)s`);

        let command = `yt-dlp`;
        
        if (format_id && format_id !== 'best' && format_id !== 'original') {
            command += ` -f ${format_id}+bestaudio[ext=m4a]/best`;
        } else if (format_id === 'audio') {
            command += ` -f bestaudio --extract-audio --audio-format mp3`;
        } else {
            command += ` -f best[ext=mp4]/best`;
        }
        
        command += ` -o "${outputPath}"`;
        command += ` --no-playlist`;
        command += ` --no-warnings`;
        command += ` --no-check-certificate`;
        command += ` "${url}"`;
        
        console.log('Running:', command);

        await executeCommand(command);
        
        const files = fs.readdirSync(TEMP_DIR)
            .filter(f => f.startsWith(videoId))
            .map(f => path.join(TEMP_DIR, f));
        
        if (files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Download failed - no file created' 
            });
        }

        const downloadedFile = files[0];
        const filename = path.basename(downloadedFile);
        
        console.log('✅ Downloaded:', filename);

        res.download(downloadedFile, filename, (err) => {
            fs.unlink(downloadedFile, () => {});
            if (err) {
                console.error('Send error:', err);
            }
        });

    } catch (error) {
        console.error('❌ Download error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Download failed: ' + error.message 
        });
    }
});

// ============================================
// STREAM ENDPOINT
// ============================================
app.get('/api/download-stream', async (req, res) => {
    try {
        const { url, format_id } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }

        let command = `yt-dlp -o -`;
        if (format_id) {
            command += ` -f ${format_id}`;
        } else {
            command += ` -f best[ext=mp4]/best`;
        }
        command += ` "${url}" --no-playlist`;

        const ytdlp = spawn('yt-dlp', command.split(' ').slice(1));

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="video_${Date.now()}.mp4"`);

        ytdlp.stdout.pipe(res);
        
        ytdlp.stderr.on('data', (data) => {
            console.error('yt-dlp stderr:', data.toString());
        });

        ytdlp.on('error', (error) => {
            console.error('Spawn error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream failed' });
            }
        });

        req.on('close', () => {
            ytdlp.kill();
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', async (req, res) => {
    try {
        const version = await executeCommand('yt-dlp --version');
        res.json({
            status: 'ok',
            yt_dlp_version: version.trim(),
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        res.json({
            status: 'warning',
            yt_dlp: 'not installed',
            error: 'yt-dlp is not installed. Video download features will not work.',
            install_guide: 'https://github.com/yt-dlp/yt-dlp#installation'
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🎥 Video Downloader API                    ║
║   Server running on port ${PORT}                ║
║                                              ║
║   GET  /                 - API info          ║
║   POST /api/video-info   - Get video info    ║
║   POST /api/download     - Download video    ║
║   GET  /api/download-stream - Stream video  ║
║   GET  /api/health       - Health check      ║
╚══════════════════════════════════════════════╝
    `);
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nCleaning up temp files...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    process.exit(0);
});
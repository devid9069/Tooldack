import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins that are on the same domain or localhost
      callback(null, true);
    },
    credentials: true
  }));
  app.use(express.json());

  // Session middleware for authentication
  app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey', // Use a strong secret from environment variables
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true, // Required for SameSite=none in most browsers
      sameSite: 'none', // Required for cross-site cookies in iframes
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    }
  }));
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Add headers for iframe compatibility
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure Multer for memory storage (Processing Tools)
  const memoryStorage = multer.memoryStorage();
  const uploadMemory = multer({
    storage: memoryStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // Increased to 100MB to match disk limit
  });

  // Configure Multer for disk storage (Hosting Tool)
  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  });
  const uploadDisk = multer({
    storage: diskStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  });

  // API Routes
  app.post("/api/upload", uploadDisk.single("image"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Use APP_URL if available, otherwise fallback to request headers
      let baseUrl = process.env.APP_URL;
      
      if (!baseUrl) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        baseUrl = `${protocol}://${host}`;
      }
      
      // Remove trailing slash if present
      baseUrl = baseUrl.replace(/\/$/, "");
      
      const url = `${baseUrl}/uploads/${req.file.filename}`;

      res.json({
        url,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auth-check", (req, res) => {
    // Set a session variable to indicate authentication
    if (req.session) {
      req.session.isAuthenticated = true;
    }
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px;">
          <h1 style="font-size: 20px;">Connection Verified</h1>
          <p>You can now close this window and return to the app.</p>
          <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer; background: #2563EB; color: white; border: none; rounded: 5px; font-weight: bold;">Close Window</button>
          <script>
            // Try to close automatically if possible
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
                window.close();
              }
            }, 2000);
          </script>
        </body>
      </html>
    `);
  });

  // 1. Image to PDF Converter
  app.post("/api/image-to-pdf", uploadMemory.array("images", 20), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

      const pdfDoc = await PDFDocument.create();
      
      for (const file of files) {
        // Convert all images to JPEG for maximum compatibility with pdf-lib
        const jpegBuffer = await sharp(file.buffer).jpeg().toBuffer();
        const image = await pdfDoc.embedJpg(jpegBuffer);
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Image Compressor
  app.post("/api/compress", uploadMemory.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const quality = parseInt(req.body.quality as string) || 80;
      
      const metadata = await sharp(req.file.buffer).metadata();
      const format = metadata.format;

      let pipeline = sharp(req.file.buffer);

      if (format === 'png') {
        // For PNG, we use palette-based compression which is very effective
        pipeline = pipeline.png({ quality, palette: true, colors: 256 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      } else {
        // Default to JPEG for others
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      }

      const buffer = await pipeline.toBuffer();
      res.setHeader('Content-Type', `image/${format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpeg'}`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. JPG <-> PNG Converter
  app.post("/api/convert-format", uploadMemory.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const targetFormat = req.body.format === 'png' ? 'png' : 'jpeg';
      
      let pipeline = sharp(req.file.buffer);
      if (targetFormat === 'png') pipeline = pipeline.png();
      else pipeline = pipeline.jpeg();

      const buffer = await pipeline.toBuffer();
      res.setHeader('Content-Type', `image/${targetFormat}`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. WebP Converter
  app.post("/api/webp-convert", uploadMemory.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const quality = parseInt(req.body.quality as string) || 80;
      
      const buffer = await sharp(req.file.buffer)
        .webp({ quality })
        .toBuffer();

      res.setHeader('Content-Type', 'image/webp');
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Resize Tool
  app.post("/api/resize", uploadMemory.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const width = parseInt(req.body.width as string) || null;
      const height = parseInt(req.body.height as string) || null;
      
      const buffer = await sharp(req.file.buffer)
        .resize(width, height, { fit: 'inside' })
        .toBuffer();

      res.setHeader('Content-Type', req.file.mimetype);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Image to Prompt (Gemini Vision) - MOVED TO FRONTEND
  app.post("/api/image-to-prompt", (req, res) => {
    res.status(410).json({ error: "This endpoint has been moved to the frontend for security and performance. Please update your client." });
  });

  // 8. Watermark Adder
  app.post("/api/watermark", uploadMemory.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const text = req.body.text || "Watermark";
      const opacity = parseFloat(req.body.opacity as string) || 0.5;

      const metadata = await sharp(req.file.buffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 600;
      const format = metadata.format || 'jpeg';

      // Escape special characters for SVG
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const svgText = `
        <svg width="${width}" height="${height}">
          <style>
            .title { 
              fill: white; 
              font-size: ${Math.floor(width / 10)}px; 
              font-weight: bold; 
              opacity: ${opacity};
              font-family: sans-serif;
            }
          </style>
          <text 
            x="50%" 
            y="50%" 
            text-anchor="middle" 
            dominant-baseline="middle"
            class="title"
          >${escapedText}</text>
        </svg>
      `;

      let pipeline = sharp(req.file.buffer)
        .composite([{ input: Buffer.from(svgText), gravity: 'center' }]);

      // Ensure we output in the same format as input
      if (format === 'png') pipeline = pipeline.png();
      else if (format === 'webp') pipeline = pipeline.webp();
      else pipeline = pipeline.jpeg();

      const buffer = await pipeline.toBuffer();

      res.setHeader('Content-Type', `image/${format === 'jpeg' ? 'jpeg' : format}`);
      res.send(buffer);
    } catch (err: any) {
      console.error("Watermark error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadsDir));
  app.use("/u", express.static(uploadsDir));

  // Error handler for Multer and other errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

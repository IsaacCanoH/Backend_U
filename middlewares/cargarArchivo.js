import multer from "multer";
import path from "path";
import fs from "fs";

const cargarRuta = path.join(process.cwd(), "uploads/temp");

if (!fs.existsSync(cargarRuta)) {
  fs.mkdirSync(cargarRuta, { recursive: true });
}

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cargarRuta),
  filename: (req, file, cb) => {
    const nombreUnico = `${Date.now()}-${file.originalname}`;
    cb(null, nombreUnico);
  },
});

const cargarArchivos = multer({ 
  storage: almacenamiento,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB máximo
});

export default cargarArchivos;
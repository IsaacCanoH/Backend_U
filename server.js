import app from "./app.js";
import conectarDB from "./config/conexion.js";

const PORT = process.env.PORT || 3000;

(async () => {
  await conectarDB();
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
})();

import sequelize from "./baseDeDatos.js";

const conectarDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Conexión a la base de datos exitosa");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error);
    process.exit(1); // detener el server si no hay conexión
  }
};

export default conectarDB;

import Sequelize from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,             // true si se quiere ver las queries en consola
    define: {
      timestamps: false,        // agrega createdAt y updatedAt automáticamente
      underscored: true,        // true -> usa snake_case en vez de camelCase en DB
      freezeTableName: true,    // true -> evita pluralización automática de tablas - Ejemplo usuario = usuario de lo contraio seria usuarios
    },
    dialectOptions: {
      // ssl: {
      //   require: true,
      //   rejectUnauthorized: false,
      // },
    }
  }
);

export default sequelize;

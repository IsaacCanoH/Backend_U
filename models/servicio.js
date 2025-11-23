import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';

const Servicio = sequelize.define('servicio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false
  },
  es_base: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
});

export default Servicio;

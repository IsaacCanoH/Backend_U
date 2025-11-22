import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';

const universidad = sequelize.define('catalogo_universidad', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false
  },
  municipio: {
    type: DataTypes.STRING,
    allowNull: false
  },
  localidad: {
    type: DataTypes.STRING,
    allowNull: false
  },
  calle_numero: {
    type: DataTypes.STRING
  },
  colonia: {
    type: DataTypes.STRING
  },
  codigo_postal: {
    type: DataTypes.STRING
  },
  ubicacion: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: false
  }
});

export default universidad;

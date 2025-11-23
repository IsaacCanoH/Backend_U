import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';
import Propiedad from './propiedad.js';

const Unidad = sequelize.define('unidad', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  propiedad_id: {
    type: DataTypes.INTEGER
  },
  nombre: {
    type: DataTypes.STRING
  },
  precio: {
    type: DataTypes.DECIMAL
  },
  estado: {
    type: DataTypes.STRING
  },
  descripcion: {
    type: DataTypes.JSONB
  },
  imagenes: {
    type: DataTypes.JSONB
  }
});

export default Unidad;
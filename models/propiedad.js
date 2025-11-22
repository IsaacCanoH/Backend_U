import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';
import Documento from './documento.js';
import Unidad from './unidad.js';

const Propiedad = sequelize.define('propiedad', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rentero_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rentero',
      key: 'id'
    }
  },
  nombre: {
    type: DataTypes.STRING
  },
  calle: {
    type: DataTypes.STRING
  },
  colonia: {
    type: DataTypes.STRING
  },
  numero: {
    type: DataTypes.STRING
  },
  codigo_postal: {
    type: DataTypes.STRING
  },
  ubicacion: {
  type: DataTypes.GEOGRAPHY('POINT', 4326),
  // Función para convertir el formato
  set(value) {
    if (value && value.type === 'Point' && value.coordinates) {
      this.setDataValue('ubicacion', {
        type: 'Point',
        coordinates: value.coordinates
      });
    }
  }
  },
  visible: {
    type: DataTypes.BOOLEAN
  },
  municipio: {
    type: DataTypes.STRING
  },
  estado: {
    type: DataTypes.STRING
  },
});

// Asociaciones
Propiedad.hasMany(Documento, { foreignKey: 'propiedad_id' });

export default Propiedad;
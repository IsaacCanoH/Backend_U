// models/tipoDocumento.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';

const TipoDocumento = sequelize.define('tipo_documento', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  campos_requeridos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  }
}, {
  tableName: 'tipo_documento',
  timestamps: false
});

export default TipoDocumento;
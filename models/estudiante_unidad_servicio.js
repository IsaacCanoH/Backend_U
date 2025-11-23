// Backend_U/models/estudiante_unidad_servicio.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';

const EstudianteUnidadServicio = sequelize.define('estudiante_unidad_servicio', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  estudiante_unidad_id: { type: DataTypes.INTEGER, allowNull: false },
  servicio_id: { type: DataTypes.INTEGER, allowNull: false },
  fecha_agregado: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  precio_snapshot: { type: DataTypes.DECIMAL(10,2), allowNull: true },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'activo' },
  fecha_inicio: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  fecha_fin: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'estudiante_unidad_servicio',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['estudiante_unidad_id', 'servicio_id'] }
  ]
});

export default EstudianteUnidadServicio;

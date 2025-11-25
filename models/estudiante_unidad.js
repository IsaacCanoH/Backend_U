import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';
import Servicio from './servicio.js';
import EstudianteUnidadServicio from './estudiante_unidad_servicio.js';

const EstudianteUnidad = sequelize.define('estudiante_unidad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  estudiante_id: { type: DataTypes.INTEGER, allowNull: false },
  unidad_id: { type: DataTypes.INTEGER, allowNull: false },
  fecha_union: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  timestamps: false,
  tableName: 'estudiante_unidad'
});

// Asociación Many-to-Many: EstudianteUnidad <-> Servicio (through EstudianteUnidadServicio)
EstudianteUnidad.belongsToMany(Servicio, {
  through: EstudianteUnidadServicio,
  foreignKey: 'estudiante_unidad_id',
  otherKey: 'servicio_id',
  as: 'servicios'
});

Servicio.belongsToMany(EstudianteUnidad, {
  through: EstudianteUnidadServicio,
  foreignKey: 'servicio_id',
  otherKey: 'estudiante_unidad_id',
  as: 'asignaciones'
});

export default EstudianteUnidad;

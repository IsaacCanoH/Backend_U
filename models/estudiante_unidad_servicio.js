import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';

const EstudianteUnidadServicio = sequelize.define('estudiante_unidad_servicio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  estudiante_unidad_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'estudiante_unidad',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  servicio_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'servicio',
      key: 'id'
    }
  },
  fecha_agregado: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'estudiante_unidad_servicio',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['estudiante_unidad_id', 'servicio_id']
    }
  ]
});

export default EstudianteUnidadServicio;

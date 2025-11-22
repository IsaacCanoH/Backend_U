import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';
import Documento from './documento.js';
import bcrypt from 'bcryptjs';

const Rentero = sequelize.define('rentero', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING
  },
  apellido: {
    type: DataTypes.STRING
  },
  email: {
    type: DataTypes.STRING
  },
  password: {
    type: DataTypes.STRING
  },
  telefono: {
    type: DataTypes.STRING
  }
},{
  hooks: {
    // Hook para hashear la contraseña antes de crear el usuario
    beforeCreate: async (rentero) => {
      if (rentero.password) {
        const salt = await bcrypt.genSalt(10);
        rentero.password = await bcrypt.hash(rentero.password, salt);
      }
    },
    // Hook para hashear la contraseña antes de actualizar el usuario
    beforeUpdate: async (rentero) => {
      if (rentero.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        rentero.password = await bcrypt.hash(rentero.password, salt);
      }
    }
  }
});

// Método de instancia para verificar contraseña
Rentero.prototype.verificarPassword = async function(passwordIngresada) {
  return await bcrypt.compare(passwordIngresada, this.password);
};

// Asociaciones
Rentero.hasMany(Documento, { foreignKey: 'rentero_id' });

export default Rentero;
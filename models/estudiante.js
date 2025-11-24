import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';
import bcrypt from 'bcryptjs';

const Estudiante = sequelize.define('estudiante', {
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
    type: DataTypes.STRING,
    allowNull: false
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
    beforeCreate: async (estudiante) => {
      if (estudiante.password) {
        const salt = await bcrypt.genSalt(10);
        estudiante.password = await bcrypt.hash(estudiante.password, salt);
      }
    },
    // Hook para hashear la contraseña antes de actualizar el usuario
    beforeUpdate: async (estudiante) => {
      if (estudiante.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        estudiante.password = await bcrypt.hash(estudiante.password, salt);
      }
    }
  }
});

// Método de instancia para verificar contraseña
Estudiante.prototype.verificarPassword = async function(passwordIngresada) {
  return await bcrypt.compare(passwordIngresada, this.password);
};

export default Estudiante;
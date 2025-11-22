import { DataTypes } from 'sequelize';
import sequelize from '../config/baseDeDatos.js';

const Documento = sequelize.define('documento',{
    id:{
        type: DataTypes.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    rentero_id:{
        type: DataTypes.INTEGER,
        allowNull:true,
        references:{
            model:'rentero',
            key:'id'
        }
    },
    propiedad_id:{
        type: DataTypes.INTEGER,
        allowNull:true,
        references:{
            model:'propiedad',
            key:'id'
        }
    },
    tipo_id:{
        type: DataTypes.INTEGER,
        allowNull:false,
        references:{
            model:'tipo_documento',
            key:'id'
        }
    },
    ruta_archivo:{
        type: DataTypes.STRING
    }
});

export default Documento;
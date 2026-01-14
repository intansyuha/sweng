// models/Route.js
const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    routeId: { 
        type: String, 
        unique: true, 
        required: true 
    },
    from: { 
        type: String, 
        required: true 
    },
    to: { 
        type: String, 
        required: true 
    },
    departureTime: { 
        type: String, 
        required: true 
    },
    driverAssigned: { 
        type: String, 
        default: 'Unassigned' 
    },
    capacity: {
        type: Number,
        default: 40 // Default shuttle capacity
    }
});

module.exports = mongoose.model('Route', routeSchema);
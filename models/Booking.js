// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    studentId: { 
        type: String, 
        required: true 
    },
    routeId: { 
        type: String, 
        required: true 
    },
    time: { 
        type: String, 
        required: true 
    },
    status: {
        type: String,
        enum: ['Confirmed', 'Cancelled'],
        default: 'Confirmed'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Booking', bookingSchema);
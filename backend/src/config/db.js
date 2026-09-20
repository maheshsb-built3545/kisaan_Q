const mongoose = require('mongoose');
const dns = require('dns');

// Configure DNS resolution resilience
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if not supported
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri || uri === 'YOUR_MONGODB_CONNECTION_STRING_HERE') {
    console.warn('\n' + '='.repeat(70));
    console.warn('⚠️  [Database Warning] Please configure MONGODB_URI in your .env file.');
    console.warn('ℹ️  Running backend in graceful degraded mode (dev-only in-memory fallback).');
    console.warn('   Per-service in-memory fallback active. No sync back to Atlas.');
    console.warn('   Example Atlas URI: mongodb+srv://<user>:<pwd>@cluster0.xxxxx.mongodb.net/kisanq');
    console.warn('='.repeat(70) + '\n');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`🟢 Connected to MongoDB Atlas: KisanQ Cluster (${conn.connection.host})`);
  } catch (error) {
    console.warn('\n' + '='.repeat(70));
    console.warn(`⚠️  [Database Notice] MongoDB Atlas connection failed (${error.message}).`);
    console.warn('   Running backend in graceful degraded mode (dev-only in-memory fallback).');
    console.warn('   Per-service in-memory fallback active. No sync back to Atlas.');
    console.warn('='.repeat(70) + '\n');

    if (process.env.NODE_ENV === 'production') {
      console.error('🛑 Production environment requires MongoDB Atlas connectivity. Exiting process.');
      process.exit(1);
    }
  }
};

module.exports = connectDB;

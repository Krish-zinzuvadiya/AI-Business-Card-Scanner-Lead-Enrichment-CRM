const app = require("./app");
const { connectDb } = require("./config/db");

const port = Number(process.env.PORT || 5000);

async function start() {
  try {
    await connectDb();
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();

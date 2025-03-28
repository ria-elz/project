const bcrypt = require('bcrypt');

async function hashPassword() {
    const hashedPassword = await bcrypt.hash('root', 10);
    console.log("New Hashed Admin Password:", hashedPassword);
}

hashPassword();

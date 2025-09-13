const pool = require('../utils/pool');
const Todo = require('../models/Todo');

module.exports = class User {
  id;
  email;
  todos;
  #passwordHash; // private class field: hides it from anything outside of this class definition

  constructor(row) {
    this.id = row.id;
    this.email = row.email;
    this.#passwordHash = row.password_hash;
  }

  static async insert({ email, passwordHash }) {
    const { rows } = await pool.query(
      `
      INSERT INTO users2 ( email, password_hash)
      VALUES ($1, $2)
      RETURNING *
    `,
      [email, passwordHash]
    );

    return new User(rows[0]);
  }

  static async getAll() {
    const { rows } = await pool.query('SELECT * FROM users2');
    return rows.map((row) => new User(row));
  }

  static async getByEmail(email) {
    const { rows } = await pool.query(
      `
      SELECT *
      FROM users2
      WHERE email=$1
      `,
      [email]
    );

    if (!rows[0]) return null;

    return new User(rows[0]);
  }

  get passwordHash() {
    return this.#passwordHash;
  }

  async getTodos() {
    const { rows } = await pool.query(
      `
      SELECT * FROM todos5
      WHERE user_id=$1
      ORDER BY created_at DESC;
      
    `,
      [this.id]
    );

    this.todos = rows.map((row) => new Todo(row));
  }
};

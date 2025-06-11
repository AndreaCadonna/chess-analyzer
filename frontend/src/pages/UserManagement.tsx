// frontend/src/pages/UserManagement.tsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  getAllUsers,
  createUser,
  deleteUser,
  validateChessComUsername,
} from "../services/api";

import type { User, CreateUserRequest } from "../types/api";

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create user form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    chessComUsername: "",
    email: "",
  });
  const [validatingUsername, setValidatingUsername] = useState(false);
  const [usernameValid, setUsernameValid] = useState<boolean | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.chessComUsername.trim()) {
      setError("Chess.com username is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const userData: CreateUserRequest = {
        chessComUsername: createForm.chessComUsername.trim(),
      };

      if (createForm.email?.trim()) {
        userData.email = createForm.email.trim();
      }

      const newUser = await createUser(userData);

      setSuccess(`User ${newUser.chessComUsername} created successfully!`);
      setCreateForm({ chessComUsername: "", email: "" });
      setShowCreateForm(false);
      setUsernameValid(null);

      // Refresh users list
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user ${username}? This will also delete all their games.`
      )
    ) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      await deleteUser(userId);
      setSuccess(`User ${username} deleted successfully`);

      // Refresh users list
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const validateUsername = async (username: string) => {
    if (!username.trim()) {
      setUsernameValid(null);
      return;
    }

    try {
      setValidatingUsername(true);
      const isValid = await validateChessComUsername(username.trim());
      setUsernameValid(isValid);
    } catch {
      setUsernameValid(false);
    } finally {
      setValidatingUsername(false);
    }
  };

  const handleUsernameChange = (username: string) => {
    setCreateForm({ ...createForm, chessComUsername: username });

    // Debounce validation
    const timeoutId = setTimeout(() => {
      validateUsername(username);
    }, 1000);

    return () => clearTimeout(timeoutId);
  };

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>User Management</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="primary-button"
        >
          {showCreateForm ? "Cancel" : "Add New User"}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="alert success">
          <strong>Success:</strong> {success}
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div className="create-user-section">
          <h2>Create New User</h2>
          <form onSubmit={handleCreateUser} className="create-user-form">
            <div className="form-group">
              <label htmlFor="chessComUsername">Chess.com Username *</label>
              <div className="input-with-validation">
                <input
                  type="text"
                  id="chessComUsername"
                  value={createForm.chessComUsername}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  disabled={creating}
                  placeholder="Enter Chess.com username"
                  required
                />
                {validatingUsername && (
                  <span className="validation-spinner">Validating...</span>
                )}
                {usernameValid === true && (
                  <span className="validation-success">✅ Valid username</span>
                )}
                {usernameValid === false && (
                  <span className="validation-error">
                    ❌ Username not found
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email (optional)</label>
              <input
                type="email"
                id="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                disabled={creating}
                placeholder="Enter email address"
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={creating || usernameValid !== true}
                className="primary-button"
              >
                {creating ? "Creating..." : "Create User"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm({ chessComUsername: "", email: "" });
                  setUsernameValid(null);
                }}
                disabled={creating}
                className="secondary-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="users-section">
        <h2>Existing Users ({users.length})</h2>

        {users.length === 0 ? (
          <div className="empty-state">
            <p>No users found. Create your first user to get started!</p>
          </div>
        ) : (
          <div className="users-grid">
            {users.map((user) => (
              <div key={user.id} className="user-card">
                <div className="user-header">
                  <h3>{user.chessComUsername}</h3>
                  <div className="user-actions">
                    <Link
                      to={`/import/${user.id}`}
                      className="action-button primary"
                    >
                      Import Games
                    </Link>
                    <Link
                      to={`/games/${user.id}`}
                      className="action-button secondary"
                    >
                      View Games
                    </Link>
                    <button
                      onClick={() =>
                        handleDeleteUser(user.id, user.chessComUsername)
                      }
                      className="action-button danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="user-details">
                  {user.email && (
                    <div className="detail">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{user.email}</span>
                    </div>
                  )}

                  <div className="detail">
                    <span className="detail-label">Games:</span>
                    <span className="detail-value">{user.gameCount}</span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {user.lastImport && (
                    <div className="detail">
                      <span className="detail-label">Last Import:</span>
                      <span className="detail-value">
                        {new Date(user.lastImport).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;

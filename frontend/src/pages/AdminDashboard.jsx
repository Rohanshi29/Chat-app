import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { API_URL } from "../api/axios";

const StatCard = ({ label, value }) => (
  <div className="stat-card">
    <span className="stat-value">{value}</span>
    <span className="stat-label">{label}</span>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const banUser = async (id) => {
    await api.put(`/admin/users/${id}/ban`);
    load();
  };

  const unbanUser = async (id) => {
    await api.put(`/admin/users/${id}/unban`);
    load();
  };

  const deleteUser = async (id) => {
    if (!confirm("Delete this user permanently?")) return;
    await api.delete(`/admin/users/${id}`);
    load();
  };

  const maxDaily = Math.max(1, ...(stats?.dailyMessages.map((d) => d.count) || [1]));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin dashboard</h1>
        <Link to="/" className="link-btn">
          ← Back to chat
        </Link>
      </div>

      {loading && <p className="muted">Loading...</p>}
      {error && <p className="form-error">{error}</p>}

      {stats && (
        <>
          <div className="stat-grid">
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard label="Active now" value={stats.activeUsers} />
            <StatCard label="Banned" value={stats.bannedUsers} />
            <StatCard label="Total messages" value={stats.totalMessages} />
            <StatCard label="Messages today" value={stats.messagesToday} />
            <StatCard label="Total chats" value={stats.totalChats} />
            <StatCard label="Group chats" value={stats.groupChats} />
          </div>

          <h2>Messages, last 7 days</h2>
          <div className="bar-chart">
            {stats.dailyMessages.map((d) => (
              <div key={d.date} className="bar-chart-col">
                <div
                  className="bar-chart-bar"
                  style={{ height: `${(d.count / maxDaily) * 100}%` }}
                  title={`${d.count} messages`}
                />
                <span className="bar-chart-label">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Users</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td className="admin-table-user">
                {u.profilePicture ? (
                  <img src={`${API_URL}${u.profilePicture}`} alt="" className="avatar avatar-sm" />
                ) : (
                  <div className="avatar avatar-sm avatar-placeholder">
                    {u.username[0].toUpperCase()}
                  </div>
                )}
                {u.username}
              </td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                {u.isBanned ? (
                  <span className="badge badge-danger">Banned</span>
                ) : u.isOnline ? (
                  <span className="badge badge-success">Online</span>
                ) : (
                  <span className="badge">Offline</span>
                )}
              </td>
              <td className="admin-table-actions">
                {u.role !== "admin" && (
                  <>
                    {u.isBanned ? (
                      <button onClick={() => unbanUser(u._id)}>Unban</button>
                    ) : (
                      <button onClick={() => banUser(u._id)}>Ban</button>
                    )}
                    <button className="danger-btn" onClick={() => deleteUser(u._id)}>
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminDashboard;

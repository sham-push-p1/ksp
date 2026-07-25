import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "../utils/api";
import { useToast } from "./Toast";
import { useApp } from "../context/AppContext";
import styles from "./AdminPanel.module.css";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(5, "Password must be at least 5 characters").max(100),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  role: z.string(),
  districtName: z.string().optional(),
  stationName: z.string().optional(),
});

export default function AdminPanel() {
  const { user } = useApp();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", password: "", name: "", role: "OFFICER", districtName: "", stationName: "" }
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err) {
      toast.error("Failed to load users", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      await api.createUser(data);
      toast.success("User Created", `Successfully created user ${data.username}`);
      reset();
      fetchUsers();
    } catch (err) {
      toast.error("Creation Failed", err.message);
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to delete ${username}?`)) return;
    try {
      await api.deleteUser(id);
      toast.success("User Deleted", `${username} has been removed.`);
      fetchUsers();
    } catch (err) {
      toast.error("Deletion Failed", err.message);
    }
  };

  if (user?.role !== "ADMIN") {
    return <div className="analysis-panel placeholder">You do not have permission to view this page.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Admin: User Management</h3>
        <p className={styles.subtitle}>Manage platform access, roles, and jurisdictions.</p>
      </div>

      <div className={styles.grid}>
        {/* Create User Form */}
        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Create New User</h4>
          <form onSubmit={handleSubmit(handleCreate)} className={styles.form}>
            <div>
              <input placeholder="Username" {...register("username")} className={styles.input} />
              {errors.username && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.username.message}</p>}
            </div>
            
            <div>
              <input placeholder="Password" type="password" {...register("password")} className={styles.input} />
              {errors.password && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.password.message}</p>}
            </div>

            <div>
              <input placeholder="Full Name" {...register("name")} className={styles.input} />
              {errors.name && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.name.message}</p>}
            </div>

            <div>
              <select {...register("role")} className={styles.input}>
                <option value="ADMIN">ADMIN</option>
                <option value="OFFICER">OFFICER</option>
                <option value="CONSTABLE">CONSTABLE</option>
              </select>
              {errors.role && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.role.message}</p>}
            </div>

            <div>
              <input placeholder="District (Optional)" {...register("districtName")} className={styles.input} />
              {errors.districtName && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.districtName.message}</p>}
            </div>

            <div>
              <input placeholder="Station (Optional)" {...register("stationName")} className={styles.input} />
              {errors.stationName && <p style={{color: "red", fontSize: "12px", margin: "2px 0 8px"}}>{errors.stationName.message}</p>}
            </div>

            <button type="submit" className={styles.submitBtn}>Create User</button>
          </form>
        </div>

        {/* User List */}
        <div className={`${styles.card} ${styles.tableContainer}`}>
          <h4 className={styles.cardTitle}>Active Accounts</h4>
          {loading ? <p>Loading...</p> : (
            <table className="results-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.UserID}>
                    <td style={{ fontWeight: "bold" }}>{u.Username}</td>
                    <td>{u.Name}</td>
                    <td><span className="status-badge status-open">{u.Role}</span></td>
                    <td>{u.DistrictName || "State-wide"} {u.StationName ? `(${u.StationName})` : ""}</td>
                    <td>
                      {u.UserID !== user.userId && (
                        <button onClick={() => handleDelete(u.UserID, u.Username)} className={styles.deleteBtn}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

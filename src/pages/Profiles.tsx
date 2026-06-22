import { useEffect, useState } from "react";
import type { Profile, CreateProfileInput } from "../types";
import { D2R_CLASSES, GAME_MODES } from "../types";
import { createProfile, getProfiles, deleteProfile } from "../api";

interface Props {
  onSelectProfile: (profile: Profile) => void;
}

export default function Profiles({ onSelectProfile }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateProfileInput>({
    name: "",
    class: D2R_CLASSES[0],
    mode: GAME_MODES[0],
  });

  const loadProfiles = async () => {
    const data = await getProfiles();
    setProfiles(data);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProfile(form);
    setForm({ name: "", class: D2R_CLASSES[0], mode: GAME_MODES[0] });
    setShowForm(false);
    loadProfiles();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this profile and all its data?")) {
      await deleteProfile(id);
      loadProfiles();
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Profiles</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Profile"}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Character name"
              />
            </div>
            <div className="form-group">
              <label>Class</label>
              <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                {D2R_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {GAME_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Create Profile</button>
        </form>
      )}

      <div className="profiles-grid">
        {profiles.map((profile) => (
          <div key={profile.id} className="profile-card">
            <div className="profile-card-header">
              <h3>{profile.name}</h3>
              <span className="badge">{profile.class}</span>
            </div>
            <div className="profile-card-body">
              <p>{profile.mode}</p>
            </div>
            <div className="profile-card-actions">
              <button className="btn btn-sm" onClick={() => onSelectProfile(profile)}>
                Select
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(profile.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && !showForm && (
          <p className="empty-state">No profiles created. Create one to get started!</p>
        )}
      </div>
    </div>
  );
}

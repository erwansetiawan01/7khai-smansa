// Auth helper: Login Pengguna
async function loginUser(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Gagal Login:", error.message);
        return false;
    }
    return data;
}

// Fetch Rekapitulasi Kelas untuk Wali Kelas (Filter by Class ID)
async function fetchClassSummary(classId) {
    const { data, error } = await supabaseClient
        .from('daily_habits')
        .select(`
            id,
            entry_date,
            bangun_pagi, beribadah, berolahraga, makan_sehat, gemar_belajar, bermasyarakat, tidur_cepat,
            validated_by_parent,
            profiles!inner ( full_name, class_id )
        `)
        .eq('profiles.class_id', classId);

    if (error) {
        console.error("Gagal mengambil data kelas:", error);
        return [];
    }
    return data;
}

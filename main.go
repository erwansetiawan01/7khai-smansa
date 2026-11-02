package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	_ "[suspicious link removed]"
)

// DailyHabit Struct mewakili tabel daily_habits 7KAIH
type DailyHabit struct {
	ID                 string    `json:"id"`
	StudentID          string    `json:"student_id"`
	EntryDate          string    `json:"entry_date"`
	BangunPagi         bool      `json:"bangun_pagi"`
	Beribadah          bool      `json:"beribadah"`
	Berolahraga        bool      `json:"berolahraga"`
	MakanSehat         bool      `json:"makan_sehat"`
	GemarBelajar       bool      `json:"gemar_belajar"`
	Bermasyarakat      bool      `json:"bermasyarakat"`
	TidurCepat         bool      `json:"tidur_cepat"`
	ScreenTimeHours    float64   `json:"screen_time_hours"`
	ValidatedByParent  bool      `json:"validated_by_parent"`
	ValidatedByTeacher bool      `json:"validated_by_teacher"`
	CreatedAt          time.Time `json:"created_at"`
}

var db *sql.DB

func main() {
	// Ambil URI Database Supabase dari Environment Variable atau gunakan fallback
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Ganti Kredensial DB Supabase Anda (Host, User, Password, DB)
		dbURL = "postgresql://postgres:PASSWORD_SUPABASE_ANDA@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require"
	}

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Gagal membuka koneksi database: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Printf("Peringatan: Tidak dapat menjangkau database Supabase: %v", err)
	} else {
		log.Println("Berhasil terhubung ke Database Supabase PostgreSQL!")
	}

	mux := http.NewServeMux()

	// Rute API RESTful
	mux.HandleFunc("/api/habits", handleHabits)              // GET (list), POST (create)
	mux.HandleFunc("/api/habits/", handleHabitByID)          // GET, PUT, DELETE by ID
	mux.HandleFunc("/api/habits/import", handleImportCSV)    // POST multipart CSV
	mux.HandleFunc("/api/habits/export", handleExportCSV)    // GET CSV export

	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server Golang 7KAIH SMAN 1 Bogor berjalan di http://localhost:%s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

// Middleware CORS untuk komunikasi dengan Frontend Web
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Handler /api/habits (List & Create)
func handleHabits(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		getHabits(w, r)
	case http.MethodPost:
		createHabit(w, r)
	default:
		http.Error(w, "Metode HTTP tidak diizinkan", http.StatusMethodNotAllowed)
	}
}

// Handler /api/habits/{id} (Read One, Update, Delete)
func handleHabitByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/habits/")
	if id == "" || id == "import" || id == "export" {
		http.Error(w, "ID tidak valid", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		getHabitByID(w, r, id)
	case http.MethodPut:
		updateHabit(w, r, id)
	case http.MethodDelete:
		deleteHabit(w, r, id)
	default:
		http.Error(w, "Metode HTTP tidak diizinkan", http.StatusMethodNotAllowed)
	}
}

// 1. READ LIST (GET /api/habits)
func getHabits(w http.ResponseWriter, r *http.Request) {
	studentID := r.URL.Query().Get("student_id")
	entryDate := r.URL.Query().Get("entry_date")

	query := `SELECT id, student_id, entry_date, bangun_pagi, beribadah, berolahraga, 
	                 makan_sehat, gemar_belajar, bermasyarakat, tidur_cepat, 
	                 screen_time_hours, validated_by_parent, validated_by_teacher, created_at 
	          FROM public.daily_habits WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	if studentID != "" {
		query += fmt.Sprintf(" AND student_id = $%d", argPos)
		args = append(args, studentID)
		argPos++
	}
	if entryDate != "" {
		query += fmt.Sprintf(" AND entry_date = $%d", argPos)
		args = append(args, entryDate)
		argPos++
	}

	query += " ORDER BY entry_date DESC LIMIT 100"

	rows, err := db.Query(query, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Gagal mengambil data: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	habits := []DailyHabit{}
	for rows.Next() {
		var h DailyHabit
		var t time.Time
		err := rows.Scan(
			&h.ID, &h.StudentID, &t,
			&h.BangunPagi, &h.Beribadah, &h.Berolahraga,
			&h.MakanSehat, &h.GemarBelajar, &h.Bermasyarakat, &h.TidurCepat,
			&h.ScreenTimeHours, &h.ValidatedByParent, &h.ValidatedByTeacher, &h.CreatedAt,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Gagal membaca baris data: %v", err), http.StatusInternalServerError)
			return
		}
		h.EntryDate = t.Format("2006-01-02")
		habits = append(habits, h)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  len(habits),
		"data":   habits,
	})
}

// 2. READ ONE (GET /api/habits/{id})
func getHabitByID(w http.ResponseWriter, r *http.Request, id string) {
	query := `SELECT id, student_id, entry_date, bangun_pagi, beribadah, berolahraga, 
	                 makan_sehat, gemar_belajar, bermasyarakat, tidur_cepat, 
	                 screen_time_hours, validated_by_parent, validated_by_teacher, created_at 
	          FROM public.daily_habits WHERE id = $1`

	var h DailyHabit
	var t time.Time
	err := db.QueryRow(query, id).Scan(
		&h.ID, &h.StudentID, &t,
		&h.BangunPagi, &h.Beribadah, &h.Berolahraga,
		&h.MakanSehat, &h.GemarBelajar, &h.Bermasyarakat, &h.TidurCepat,
		&h.ScreenTimeHours, &h.ValidatedByParent, &h.ValidatedByTeacher, &h.CreatedAt,
	)

	if err == sql.ErrNoRows {
		http.Error(w, "Data tidak ditemukan", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}
	h.EntryDate = t.Format("2006-01-02")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   h,
	})
}

// 3. CREATE (POST /api/habits)
func createHabit(w http.ResponseWriter, r *http.Request) {
	var h DailyHabit
	if err := json.NewDecoder(r.Body).Decode(&h); err != nil {
		http.Error(w, "Format JSON tidak valid", http.StatusBadRequest)
		return
	}

	if h.StudentID == "" {
		http.Error(w, "student_id wajib diisi", http.StatusBadRequest)
		return
	}
	if h.EntryDate == "" {
		h.EntryDate = time.Now().Format("2006-01-02")
	}

	query := `INSERT INTO public.daily_habits 
		(student_id, entry_date, bangun_pagi, beribadah, berolahraga, makan_sehat, gemar_belajar, bermasyarakat, tidur_cepat, screen_time_hours, validated_by_parent, validated_by_teacher)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at`

	err := db.QueryRow(query,
		h.StudentID, h.EntryDate, h.BangunPagi, h.Beribadah, h.Berolahraga,
		h.MakanSehat, h.GemarBelajar, h.Bermasyarakat, h.TidurCepat,
		h.ScreenTimeHours, h.ValidatedByParent, h.ValidatedByTeacher,
	).Scan(&h.ID, &h.CreatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Gagal menyimpan ke database: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Log kebiasaan harian berhasil ditambahkan",
		"data":    h,
	})
}

// 4. UPDATE / EDIT (PUT /api/habits/{id})
func updateHabit(w http.ResponseWriter, r *http.Request, id string) {
	var h DailyHabit
	if err := json.NewDecoder(r.Body).Decode(&h); err != nil {
		http.Error(w, "Format JSON tidak valid", http.StatusBadRequest)
		return
	}

	query := `UPDATE public.daily_habits SET 
		bangun_pagi = $1, beribadah = $2, berolahraga = $3, makan_sehat = $4, 
		gemar_belajar = $5, bermasyarakat = $6, tidur_cepat = $7, 
		screen_time_hours = $8, validated_by_parent = $9, validated_by_teacher = $10
		WHERE id = $11`

	res, err := db.Exec(query,
		h.BangunPagi, h.Beribadah, h.Berolahraga, h.MakanSehat,
		h.GemarBelajar, h.Bermasyarakat, h.TidurCepat,
		h.ScreenTimeHours, h.ValidatedByParent, h.ValidatedByTeacher, id,
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Gagal memperbarui data: %v", err), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Data dengan ID tersebut tidak ditemukan", http.StatusNotFound)
		return
	}

	h.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Data 7KAIH berhasil diperbarui",
		"data":    h,
	})
}

// 5. DELETE (DELETE /api/habits/{id})
func deleteHabit(w http.ResponseWriter, r *http.Request, id string) {
	query := `DELETE FROM public.daily_habits WHERE id = $1`
	res, err := db.Exec(query, id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Gagal menghapus data: %v", err), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Data dengan ID tersebut tidak ditemukan", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": fmt.Sprintf("Data log dengan ID %s berhasil dihapus", id),
	})
}

// 6. IMPORT DATA CSV (POST /api/habits/import)
func handleImportCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metode HTTP tidak diizinkan", http.StatusMethodNotAllowed)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Gagal mengunggah file. Gunakan key 'file' pada form-data", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Gagal membaca format CSV", http.StatusBadRequest)
		return
	}

	if len(records) < 2 {
		http.Error(w, "File CSV kosong atau hanya berisi header", http.StatusBadRequest)
		return
	}

	successCount := 0
	failedCount := 0

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Gagal menginisialisasi transaksi database", http.StatusInternalServerError)
		return
	}

	// Gunakan Upsert ON CONFLICT untuk menghindari duplikasi data harian siswa
	stmt, err := tx.Prepare(`INSERT INTO public.daily_habits 
		(student_id, entry_date, bangun_pagi, beribadah, berolahraga, makan_sehat, gemar_belajar, bermasyarakat, tidur_cepat, screen_time_hours)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (student_id, entry_date) DO UPDATE SET
			bangun_pagi = EXCLUDED.bangun_pagi,
			beribadah = EXCLUDED.beribadah,
			berolahraga = EXCLUDED.berolahraga,
			makan_sehat = EXCLUDED.makan_sehat,
			gemar_belajar = EXCLUDED.gemar_belajar,
			bermasyarakat = EXCLUDED.bermasyarakat,
			tidur_cepat = EXCLUDED.tidur_cepat,
			screen_time_hours = EXCLUDED.screen_time_hours`)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Gagal menyiapkan query SQL", http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	for i, row := range records[1:] {
		if len(row) < 10 {
			failedCount++
			log.Printf("Baris %d dilewati: jumlah kolom tidak sesuai", i+2)
			continue
		}

		studentID := strings.TrimSpace(row[0])
		entryDate := strings.TrimSpace(row[1])
		bangunPagi := parseBool(row[2])
		beribadah := parseBool(row[3])
		berolahraga := parseBool(row[4])
		makanSehat := parseBool(row[5])
		gemarBelajar := parseBool(row[6])
		bermasyarakat := parseBool(row[7])
		tidurCepat := parseBool(row[8])
		screenTime, _ := strconv.ParseFloat(strings.TrimSpace(row[9]), 64)

		_, err := stmt.Exec(studentID, entryDate, bangunPagi, beribadah, berolahraga, makanSehat, gemarBelajar, bermasyarakat, tidurCepat, screenTime)
		if err != nil {
			failedCount++
			log.Printf("Gagal import baris %d: %v", i+2, err)
		} else {
			successCount++
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Gagal menyimpan transaksi ke database", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "success",
		"message":       "Proses Import CSV Selesai",
		"total_records": len(records) - 1,
		"imported":      successCount,
		"failed":        failedCount,
	})
}

// 7. EXPORT DATA CSV (GET /api/habits/export)
func handleExportCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Metode HTTP tidak diizinkan", http.StatusMethodNotAllowed)
		return
	}

	query := `SELECT h.id, p.full_name, c.class_name, h.entry_date, 
	                 h.bangun_pagi, h.beribadah, h.berolahraga, h.makan_sehat, 
	                 h.gemar_belajar, h.bermasyarakat, h.tidur_cepat, 
	                 h.screen_time_hours, h.validated_by_parent, h.validated_by_teacher
	          FROM public.daily_habits h
	          LEFT JOIN public.profiles p ON h.student_id = p.id
	          LEFT JOIN public.classes c ON p.class_id = c.id
	          ORDER BY h.entry_date DESC, c.class_name ASC`

	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Gagal query export data: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=rekap_7kaih_sman1bogor_%s.csv", time.Now().Format("20060102")))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Baris Header CSV
	writer.Write([]string{
		"ID Log", "Nama Siswa", "Kelas", "Tanggal",
		"Bangun Pagi", "Beribadah", "Berolahraga", "Makan Sehat",
		"Gemar Belajar", "Bermasyarakat", "Tidur Cepat",
		"Screen Time (Jam)", "Validasi Ortu", "Validasi Wali Kelas",
	})

	for rows.Next() {
		var id, fullName, className, entryDate string
		var bangun, ibadah, olahraga, makan, belajar, masyarakat, tidur, parentVal, teacherVal bool
		var screenTime float64
		var t time.Time

		var nullFullName, nullClassName sql.NullString

		err := rows.Scan(
			&id, &nullFullName, &nullClassName, &t,
			&bangun, &ibadah, &olahraga, &makan,
			&belajar, &masyarakat, &tidur,
			&screenTime, &parentVal, &teacherVal,
		)
		if err != nil {
			log.Printf("Error scan export: %v", err)
			continue
		}

		if nullFullName.Valid {
			fullName = nullFullName.String
		} else {
			fullName = "Tanpa Nama"
		}
		if nullClassName.Valid {
			className = nullClassName.String
		} else {
			className = "-"
		}
		entryDate = t.Format("2006-01-02")

		writer.Write([]string{
			id, fullName, className, entryDate,
			fmt.Sprintf("%t", bangun), fmt.Sprintf("%t", ibadah), fmt.Sprintf("%t", olahraga), fmt.Sprintf("%t", makan),
			fmt.Sprintf("%t", belajar), fmt.Sprintf("%t", masyarakat), fmt.Sprintf("%t", tidur),
			fmt.Sprintf("%.1f", screenTime), fmt.Sprintf("%t", parentVal), fmt.Sprintf("%t", teacherVal),
		})
	}
}

func parseBool(s string) bool {
	s = strings.TrimSpace(strings.ToLower(s))
	return s == "1" || s == "true" || s == "ya" || s == "yes"
}

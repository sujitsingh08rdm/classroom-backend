import express from "express";
import { departments, subjects } from "../db/schema";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";

const router = express.Router();

//get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;

    //ensure page is never below 1, +page -> converts page string to number
    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);

    //this calculates how many records to skip in the database  -> page 1 will skips 0 records since page = 1 , limit =10, offset = (1 - 1)*10 = 0
    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // if search query exists, filter by subject name or subject code -> ilike means case-insensitive matching in SQL
    if (search) {
      filterConditions.push(
        //%${search}% means the search text can appear anywhere inside the subject name.
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
        ),
      );
    }

    //if department exists, match department name
    if (department) {
      filterConditions.push(ilike(departments.name, `%${department}%`));
    }

    //combine all filters using AND if any exists
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    //left join -> joins left table with right table, matching all value from left table to right table// it connects each subject with its department:
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const subjectsList = await db
      .select({
        ...getTableColumns(subjects),
        department: { ...getTableColumns(departments) },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectsList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    `GET /subjects error : ${error}`;
    res.status(500).json({ error: "failed to get  subjects" });
  }
});

export default router;

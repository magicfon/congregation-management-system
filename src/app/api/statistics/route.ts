import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const IDLE_THRESHOLD_DAYS = 30

export async function GET() {
  try {
    const now = new Date()

    // Summary counts
    const [totalAreas, totalMembers, activeMembers, totalSchedules, totalReports] = await Promise.all([
      prisma.area.count(),
      prisma.member.count(),
      prisma.member.count({ where: { active: true } }),
      prisma.schedule.count(),
      prisma.report.count(),
    ])

    const [completedSchedules, cancelledSchedules, pendingReports, approvedReports] = await Promise.all([
      prisma.schedule.count({ where: { status: 'completed' } }),
      prisma.schedule.count({ where: { status: 'cancelled' } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.report.count({ where: { status: 'approved' } }),
    ])

    const pendingSchedules = totalSchedules - completedSchedules - cancelledSchedules
    const completionRate = totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0
    const approvalRate = totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0

    // Area activity with idle detection
    const areas = await prisma.area.findMany({
      include: {
        _count: { select: { schedules: true, reports: true } },
      },
      orderBy: { name: 'asc' },
    })

    // We need to get member names for assignedTo
    const memberIds = areas.map((a) => a.assignedTo).filter(Boolean) as string[]
    const memberMap: Record<string, string> = {}
    if (memberIds.length > 0) {
      const membersData = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, name: true },
      })
      membersData.forEach((m) => { memberMap[m.id] = m.name })
    }

    const idleThreshold = new Date(now.getTime() - IDLE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    const areaActivity = areas.map((area) => {
      const lastActivity = new Date(area.lastActivityAt)
      const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      const isIdle = lastActivity < idleThreshold

      return {
        id: area.id,
        name: area.name,
        assignedTo: area.assignedTo ? (memberMap[area.assignedTo] ?? null) : null,
        daysSinceActivity,
        isIdle,
        _count: area._count,
      }
    })

    const idleAreas = areaActivity.filter((a) => a.isIdle)

    // Member activity
    const memberActivity = await prisma.member.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        _count: { select: { schedules: true, reports: true } },
      },
    })

    const memberActivityData = memberActivity.map((m) => ({
      id: m.id,
      name: m.name,
      schedules: m._count.schedules,
      reports: m._count.reports,
      total: m._count.schedules + m._count.reports,
    }))

    // Weekly schedule data (last 12 weeks)
    const weeks: { week: string; scheduled: number; completed: number; cancelled: number }[] = []

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const [scheduled, completed, cancelled] = await Promise.all([
        prisma.schedule.count({
          where: { date: { gte: weekStart, lt: weekEnd }, status: 'scheduled' },
        }),
        prisma.schedule.count({
          where: { date: { gte: weekStart, lt: weekEnd }, status: 'completed' },
        }),
        prisma.schedule.count({
          where: { date: { gte: weekStart, lt: weekEnd }, status: 'cancelled' },
        }),
      ])

      const month = weekStart.getMonth() + 1
      const day = weekStart.getDate()
      weeks.push({
        week: `${month}/${day}`,
        scheduled,
        completed,
        cancelled,
      })
    }

    return NextResponse.json({
      summary: {
        totalAreas,
        totalMembers,
        activeMembers,
        idleAreas: idleAreas.length,
        totalSchedules,
        completedSchedules,
        cancelledSchedules,
        pendingSchedules,
        totalReports,
        approvedReports,
        pendingReports,
        completionRate,
        approvalRate,
      },
      weeklySchedules: weeks,
      memberActivity: memberActivityData,
      areaActivity,
      idleAreas,
    })
  } catch (error) {
    console.error('GET /api/statistics error:', error)
    return NextResponse.json({ error: '無法取得統計資料' }, { status: 500 })
  }
}

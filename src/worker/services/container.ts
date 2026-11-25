import { createDb, type Database } from "../db/client";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { BackupRunRepository } from "../repositories/backup-run.repository";
import { AreaRepository } from "../repositories/area.repository";
import { GoalRepository } from "../repositories/goal.repository";
import { InboxRepository } from "../repositories/inbox.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { TaskRepository } from "../repositories/task.repository";
import { TrashRepository } from "../repositories/trash.repository";
import { BookmarkRepository, BookRepository, FileRepository } from "../repositories/knowledge/library.repository";
import { NotebookRepository, ResourceRepository } from "../repositories/knowledge/notebook.repository";
import { NoteRepository } from "../repositories/knowledge/note.repository";
import { SearchRepository } from "../repositories/knowledge/search.repository";
import { TagRepository } from "../repositories/knowledge/tag.repository";
import { FileService } from "./knowledge/file.service";
import { BookmarkService, BookService, NotebookService, ResourceService, SearchService, TagService } from "./knowledge/library.service";
import { NoteService } from "./knowledge/note.service";
import { AccountRepository, CategoryRepository, TransactionRepository } from "../repositories/personal/finance.repository";
import { ContactRepository } from "../repositories/personal/contact.repository";
import { HabitRepository } from "../repositories/personal/habit.repository";
import { JournalRepository } from "../repositories/personal/journal.repository";
import { AccountService, CategoryService, TransactionService } from "./personal/finance.service";
import { ContactService, HabitService, JournalService } from "./personal/life.service";
import { SettingsRepository } from "../repositories/settings.repository";
import { SystemRepository } from "../repositories/system.repository";
import { isoDateIn } from "../../shared/time";
import { AreaService } from "./area.service";
import { AuditService } from "./audit.service";
import { GoalService } from "./goal.service";
import { ProjectService } from "./project.service";
import { TaskService } from "./task.service";
import { TrashService } from "./trash.service";
import { InboxService } from "./inbox.service";
import { SettingsService } from "./settings.service";
import { SystemService } from "./system.service";

/**
 * Composition root: wires repositories into services for one request.
 * Routes depend on services only; services depend on repositories only.
 */
export interface Services {
  db: Database;
  audit: AuditService;
  system: SystemService;
  settings: SettingsService;
  inbox: InboxService;
  areas: AreaService;
  goals: GoalService;
  projects: ProjectService;
  tasks: TaskService;
  trash: TrashService;
  notes: NoteService;
  inboxRepo: InboxRepository;
  notebooks: NotebookService;
  resources: ResourceService;
  tags: TagService;
  bookmarks: BookmarkService;
  books: BookService;
  files: FileService;
  search: SearchService;
  accounts: AccountService;
  categories: CategoryService;
  transactions: TransactionService;
  habits: HabitService;
  journal: JournalService;
  contacts: ContactService;
}

export function createServices(env: Env, environment: string, timezone: string): Services {
  const db = createDb(env.DB);
  const repos = {
    area: new AreaRepository(db),
    goal: new GoalRepository(db),
    project: new ProjectRepository(db),
    task: new TaskRepository(db),
    inbox: new InboxRepository(db),
    note: new NoteRepository(db),
    notebook: new NotebookRepository(db),
    resource: new ResourceRepository(db),
    tag: new TagRepository(db),
    bookmark: new BookmarkRepository(db),
    book: new BookRepository(db),
    file: new FileRepository(db),
    account: new AccountRepository(db),
    category: new CategoryRepository(db),
    transaction: new TransactionRepository(db, env.DB),
    habit: new HabitRepository(db),
    journal: new JournalRepository(db),
    contact: new ContactRepository(db),
  };
  const today = () => isoDateIn(new Date(), timezone);
  const tx = repos.transaction;
  return {
    db,
    audit: new AuditService(new AuditLogRepository(db)),
    system: new SystemService(
      new SystemRepository(env.DB),
      new BackupRunRepository(db),
      env.FILES,
      environment,
    ),
    settings: new SettingsService(new SettingsRepository(db)),
    inbox: new InboxService(repos.inbox),
    areas: new AreaService(repos.area),
    goals: new GoalService(repos.goal, repos.area),
    projects: new ProjectService(repos.project, repos.area, repos.goal),
    tasks: new TaskService(repos.task, repos.project, repos.area, repos.inbox, today),
    trash: new TrashService(new TrashRepository(env.DB), {
      area: repos.area, goal: repos.goal, project: repos.project, task: repos.task, note: repos.note,
      notebook: repos.notebook, resource: repos.resource, bookmark: repos.bookmark, book: repos.book,
      account: repos.account, category: repos.category, habit: repos.habit, journal: repos.journal, contact: repos.contact,
      transaction: {
        findById: async (id: string) => {
          const r = await tx.findById(id);
          return r && { ...r, title: r.description };
        },
        purge: (id: string) => tx.purge(id),
      },
    }),
    notes: new NoteService(repos.note, repos.tag, { projects: repos.project, areas: repos.area, resources: repos.resource, notebooks: repos.notebook, books: repos.book }),
    inboxRepo: repos.inbox,
    notebooks: new NotebookService(repos.notebook),
    resources: new ResourceService(repos.resource, repos.area),
    tags: new TagService(repos.tag, { note: repos.note, task: repos.task, project: repos.project, bookmark: repos.bookmark, book: repos.book }),
    bookmarks: new BookmarkService(repos.bookmark, repos.tag, repos.resource),
    books: new BookService(repos.book, repos.tag, repos.resource, repos.file),
    files: new FileService(repos.file, env.FILES),
    search: new SearchService(new SearchRepository(env.DB)),
    accounts: new AccountService(repos.account),
    categories: new CategoryService(repos.category),
    transactions: new TransactionService(repos.transaction, repos.account, repos.category, repos.contact, repos.file),
    habits: new HabitService(repos.habit, repos.area, repos.goal, today),
    journal: new JournalService(repos.journal),
    contacts: new ContactService(repos.contact, today),
  };
}

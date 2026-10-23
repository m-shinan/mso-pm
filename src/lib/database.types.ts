export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string | null
          entity_label: string
          entity_type: string
          id: number
          organization_id: string
          project_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_label?: string
          entity_type: string
          id?: never
          organization_id: string
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_label?: string
          entity_type?: string
          id?: never
          organization_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          id: string
          issue_id: string | null
          mime_type: string
          name: string
          organization_id: string
          project_id: string
          size_bytes: number
          storage_path: string
          task_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id?: string | null
          mime_type: string
          name: string
          organization_id: string
          project_id: string
          size_bytes: number
          storage_path: string
          task_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string | null
          mime_type?: string
          name?: string
          organization_id?: string
          project_id?: string
          size_bytes?: number
          storage_path?: string
          task_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attachments_project_id_issue_id_fkey"
            columns: ["project_id", "issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "attachments_project_id_task_id_fkey"
            columns: ["project_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          body: string
          created_at: string
          done: boolean
          id: string
          organization_id: string
          project_id: string
          sort_order: number
          task_id: string
        }
        Insert: {
          body: string
          created_at?: string
          done?: boolean
          id?: string
          organization_id: string
          project_id: string
          sort_order?: number
          task_id: string
        }
        Update: {
          body?: string
          created_at?: string
          done?: boolean
          id?: string
          organization_id?: string
          project_id?: string
          sort_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_project_id_task_id_fkey"
            columns: ["project_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          contact_name: string
          contact_role: string
          created_at: string
          email: string | null
          id: string
          industry: string
          name: string
          notes: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contact_name?: string
          contact_role?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string
          name: string
          notes?: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contact_name?: string
          contact_role?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string
          name?: string
          notes?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          issue_id: string | null
          organization_id: string
          project_id: string
          task_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          issue_id?: string | null
          organization_id: string
          project_id: string
          task_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          issue_id?: string | null
          organization_id?: string
          project_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "comments_project_id_issue_id_fkey"
            columns: ["project_id", "issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "comments_project_id_task_id_fkey"
            columns: ["project_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      documents: {
        Row: {
          body: string
          created_at: string
          id: string
          organization_id: string
          project_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          organization_id: string
          project_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          project_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role_id: string
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role_id: string
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role_id?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_role_id_fkey"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      issues: {
        Row: {
          actual: string
          assignee_id: string | null
          created_at: string
          description: string
          environment: string
          expected: string
          id: string
          number: number
          organization_id: string
          priority_id: string
          priority_kind: string | null
          project_id: string
          related_task_id: string | null
          release_id: string | null
          reporter_id: string | null
          resolved_at: string | null
          severity_id: string
          severity_kind: string | null
          status_id: string
          status_kind: string | null
          steps: string[]
          title: string
          updated_at: string
        }
        Insert: {
          actual?: string
          assignee_id?: string | null
          created_at?: string
          description?: string
          environment?: string
          expected?: string
          id?: string
          number: number
          organization_id: string
          priority_id: string
          priority_kind?: string | null
          project_id: string
          related_task_id?: string | null
          release_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          severity_id: string
          severity_kind?: string | null
          status_id: string
          status_kind?: string | null
          steps?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          actual?: string
          assignee_id?: string | null
          created_at?: string
          description?: string
          environment?: string
          expected?: string
          id?: string
          number?: number
          organization_id?: string
          priority_id?: string
          priority_kind?: string | null
          project_id?: string
          related_task_id?: string | null
          release_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          severity_id?: string
          severity_kind?: string | null
          status_id?: string
          status_kind?: string | null
          steps?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_organization_id_assignee_id_fkey"
            columns: ["organization_id", "assignee_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "issues_organization_id_priority_id_priority_kind_fkey"
            columns: ["organization_id", "priority_id", "priority_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "issues_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "issues_organization_id_severity_id_severity_kind_fkey"
            columns: ["organization_id", "severity_id", "severity_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "issues_organization_id_status_id_status_kind_fkey"
            columns: ["organization_id", "status_id", "status_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "issues_project_id_related_task_id_fkey"
            columns: ["project_id", "related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "issues_project_id_release_id_fkey"
            columns: ["project_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "issues_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          name: string
          organization_id: string
          project_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          name: string
          organization_id: string
          project_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          href: string
          id: number
          kind: string
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          href?: string
          id?: never
          kind: string
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          href?: string
          id?: never
          kind?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          category: string | null
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          kind: string
          name: string
          organization_id: string
          rank: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind: string
          name: string
          organization_id: string
          rank?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name?: string
          organization_id?: string
          rank?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string
          organization_id: string
          role_id: string
          status: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          organization_id: string
          role_id: string
          status?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          organization_id?: string
          role_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_role_id_fkey"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_color: string
          name: string
          slug: string
          timezone: string
          updated_at: string
          week_start: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_color?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
          week_start?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_color?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
          week_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email_notifications: boolean
          email_assignments: boolean
          email_chat: boolean
          email_comments: boolean
          email_deadlines: boolean
          email_projects: boolean
          email_reviews: boolean
          email: string
          full_name: string
          id: string
          last_org_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email_notifications?: boolean
          email_assignments?: boolean
          email_chat?: boolean
          email_comments?: boolean
          email_deadlines?: boolean
          email_projects?: boolean
          email_reviews?: boolean
          email: string
          full_name?: string
          id: string
          last_org_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email_notifications?: boolean
          email_assignments?: boolean
          email_chat?: boolean
          email_comments?: boolean
          email_deadlines?: boolean
          email_projects?: boolean
          email_reviews?: boolean
          email?: string
          full_name?: string
          id?: string
          last_org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_org_fk"
            columns: ["last_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          organization_id: string
          project_id: string
          role_id: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          organization_id: string
          project_id: string
          role_id?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          organization_id?: string
          project_id?: string
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "project_members_organization_id_role_id_fkey"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "project_members_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_id: string | null
          target_label: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
          target_label?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
          target_label?: string | null
          target_type?: string
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string | null
          direct_key: string | null
          id: string
          kind: string
          last_message_at: string | null
          name: string | null
          organization_id: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          kind: string
          last_message_at?: string | null
          name?: string | null
          organization_id: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          name?: string | null
          organization_id?: string
          project_id?: string | null
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          added_at: string
          channel_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          channel_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          channel_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string | null
          body: string
          channel_id: string
          created_at: string
          edited_at: string | null
          id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          organization_id?: string
        }
        Relationships: []
      }
      chat_reads: {
        Row: {
          channel_id: string
          last_read_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          organization_id: string
          user_id?: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          organization_id: string | null
          organization_name: string | null
          page: string | null
          resolved_at: string | null
          status: string
          subject: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          organization_id?: string | null
          organization_name?: string | null
          page?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string | null
          organization_name?: string | null
          page?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pins: {
        Row: {
          created_at: string
          organization_id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pins_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "project_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          key: string
          name: string
          next_number: number
          organization_id: string
          priority_id: string
          priority_kind: string | null
          prod_url: string | null
          repo_url: string | null
          staging_url: string | null
          start_date: string | null
          status_id: string
          status_kind: string | null
          type_id: string
          type_kind: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          key: string
          name: string
          next_number?: number
          organization_id: string
          priority_id: string
          priority_kind?: string | null
          prod_url?: string | null
          repo_url?: string | null
          staging_url?: string | null
          start_date?: string | null
          status_id: string
          status_kind?: string | null
          type_id: string
          type_kind?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          key?: string
          name?: string
          next_number?: number
          organization_id?: string
          priority_id?: string
          priority_kind?: string | null
          prod_url?: string | null
          repo_url?: string | null
          staging_url?: string | null
          start_date?: string | null
          status_id?: string
          status_kind?: string | null
          type_id?: string
          type_kind?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_client_id_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_priority_id_priority_kind_fkey"
            columns: ["organization_id", "priority_id", "priority_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "projects_organization_id_status_id_status_kind_fkey"
            columns: ["organization_id", "status_id", "status_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "projects_organization_id_type_id_type_kind_fkey"
            columns: ["organization_id", "type_id", "type_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
        ]
      }
      releases: {
        Row: {
          changelog: Json
          created_at: string
          id: string
          name: string
          notes: string
          organization_id: string
          project_id: string
          release_date: string | null
          released_at: string | null
          status_id: string
          status_kind: string | null
          updated_at: string
          version: string
        }
        Insert: {
          changelog?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string
          organization_id: string
          project_id: string
          release_date?: string | null
          released_at?: string | null
          status_id: string
          status_kind?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          changelog?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string
          organization_id?: string
          project_id?: string
          release_date?: string | null
          released_at?: string | null
          status_id?: string
          status_kind?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "releases_organization_id_status_id_status_kind_fkey"
            columns: ["organization_id", "status_id", "status_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string
          permissions: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id: string
          permissions?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string
          permissions?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          blocked_by_id: string
          organization_id: string
          project_id: string
          task_id: string
        }
        Insert: {
          blocked_by_id: string
          organization_id: string
          project_id: string
          task_id: string
        }
        Update: {
          blocked_by_id?: string
          organization_id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_project_id_blocked_by_id_fkey"
            columns: ["project_id", "blocked_by_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "task_dependencies_project_id_task_id_fkey"
            columns: ["project_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      task_labels: {
        Row: {
          label_id: string
          organization_id: string
          project_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          organization_id: string
          project_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          organization_id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_organization_id_label_id_fkey"
            columns: ["organization_id", "label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "task_labels_project_id_task_id_fkey"
            columns: ["project_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          assignee_id: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          estimate_minutes: number | null
          id: string
          milestone_id: string | null
          number: number
          organization_id: string
          parent_id: string | null
          priority_id: string
          priority_kind: string | null
          project_id: string
          release_id: string | null
          reporter_id: string | null
          sort_order: number
          start_date: string | null
          status_id: string
          status_kind: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_minutes?: number | null
          assignee_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          estimate_minutes?: number | null
          id?: string
          milestone_id?: string | null
          number: number
          organization_id: string
          parent_id?: string | null
          priority_id: string
          priority_kind?: string | null
          project_id: string
          release_id?: string | null
          reporter_id?: string | null
          sort_order?: number
          start_date?: string | null
          status_id: string
          status_kind?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_minutes?: number | null
          assignee_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          estimate_minutes?: number | null
          id?: string
          milestone_id?: string | null
          number?: number
          organization_id?: string
          parent_id?: string | null
          priority_id?: string
          priority_kind?: string | null
          project_id?: string
          release_id?: string | null
          reporter_id?: string | null
          sort_order?: number
          start_date?: string | null
          status_id?: string
          status_kind?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_assignee_id_fkey"
            columns: ["organization_id", "assignee_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_priority_id_priority_kind_fkey"
            columns: ["organization_id", "priority_id", "priority_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "tasks_organization_id_project_id_fkey"
            columns: ["organization_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_status_id_status_kind_fkey"
            columns: ["organization_id", "status_id", "status_kind"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["organization_id", "id", "kind"]
          },
          {
            foreignKeyName: "tasks_project_id_milestone_id_fkey"
            columns: ["project_id", "milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "tasks_project_id_parent_id_fkey"
            columns: ["project_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "tasks_project_id_release_id_fkey"
            columns: ["project_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      project_progress: {
        Row: {
          done: number | null
          project_id: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      add_chat_members: { Args: { p_channel: string; p_members: string[] }; Returns: undefined }
      admin_delete_user: { Args: { p_user: string }; Returns: undefined }
      admin_list_organizations: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          last_activity_at: string | null
          members: number
          name: string
          owner_email: string | null
          projects: number
          slug: string
          tasks: number
          total: number
        }[]
      }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          confirmed: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_sign_in_at: string | null
          organizations: number
          platform_admin: boolean
          suspended: boolean
          total: number
        }[]
      }
      admin_recent_emails: {
        Args: { p_limit?: number }
        Returns: { created_at: string; error: string | null; id: number; status_code: number | null }[]
      }
      admin_set_organization_archived: { Args: { p_archived: boolean; p_org: string }; Returns: undefined }
      admin_set_platform_admin: { Args: { p_admin: boolean; p_email: string }; Returns: undefined }
      admin_set_user_suspended: { Args: { p_suspended: boolean; p_user: string }; Returns: undefined }
      admin_stats: { Args: never; Returns: Json }
      chat_overview: {
        Args: { p_org: string }
        Returns: {
          id: string
          kind: string
          last_message_at: string | null
          name: string | null
          other_user_id: string | null
          project_id: string | null
          unread: number
        }[]
      }
      create_group_chat: { Args: { p_members: string[]; p_name: string; p_org: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      mark_chat_read: { Args: { p_channel: string }; Returns: undefined }
      open_direct_chat: { Args: { p_org: string; p_user: string }; Returns: string }
      is_platform_admin: { Args: never; Returns: boolean }
      calendar_items: {
        Args: { p_from: string; p_org: string; p_to: string }
        Returns: {
          day: string
          done: boolean
          id: string
          kind: string
          label: string
          project_key: string
          status_id: string
          sub: string
        }[]
      }
      create_organization: {
        Args: {
          p_name: string
          p_slug: string
          p_template?: string
          p_timezone?: string
          p_week_start?: number
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_color: string
          name: string
          slug: string
          timezone: string
          updated_at: string
          week_start: number
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dashboard_summary: { Args: { p_org: string }; Returns: Json }
      invitation_preview: {
        Args: { p_token: string }
        Returns: {
          email: string
          expired: boolean
          organization_name: string
          role_name: string
          status: string
        }[]
      }
      my_archived_organizations: {
        Args: never
        Returns: {
          archived_at: string
          id: string
          name: string
          slug: string
        }[]
      }
      my_permissions: { Args: { p_org: string }; Returns: string[] }
      option_usage: {
        Args: { p_org: string }
        Returns: {
          option_id: string
          uses: number
        }[]
      }
      search_org: { Args: { p_org: string; p_query: string }; Returns: Json }
      set_organization_archived: {
        Args: { p_archived: boolean; p_org: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

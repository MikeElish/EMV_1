-- CreateTable
CREATE TABLE "RoleAccess" (
    "role" "Role" NOT NULL,
    "access" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAccess_pkey" PRIMARY KEY ("role")
);


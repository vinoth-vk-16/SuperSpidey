"""
Supabase Storage Module for Resume Management
Handles resume uploads and deletions in Supabase storage
"""

import os
import uuid
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables are required")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Bucket name
RESUME_BUCKET = "Resume"


def initialize_bucket():
    """Initialize the Resume bucket if it doesn't exist"""
    try:
        # Try to get the bucket
        supabase.storage.get_bucket(RESUME_BUCKET)
        print(f"✅ Bucket '{RESUME_BUCKET}' exists")
    except Exception as e:
        # Bucket doesn't exist, create it
        try:
            supabase.storage.create_bucket(RESUME_BUCKET, options={"public": False})
            print(f"✅ Created bucket '{RESUME_BUCKET}'")
        except Exception as create_error:
            error_message = str(create_error)
            # Check if bucket already exists (common error)
            if "already exists" in error_message.lower() or "violates row-level security policy" in error_message.lower():
                print(f"✅ Bucket '{RESUME_BUCKET}' already exists (this is normal)")
            else:
                print(f"⚠️ Could not create bucket: {error_message}")
                # Don't raise error - bucket might still work if it exists


# Initialize bucket on module load
initialize_bucket()


async def upload_resume_to_supabase(user_email: str, file: UploadFile) -> Tuple[str, str]:
    """
    Upload a resume PDF to Supabase storage.
    
    Args:
        user_email: User's email address
        file: UploadFile object containing the PDF
        
    Returns:
        Tuple of (storage_path, public_url)
        
    Raises:
        HTTPException: If upload fails
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Generate unique filename
        unique_id = str(uuid.uuid4())
        file_path = f"{user_email}/{unique_id}.pdf"
        
        # Read file content
        file_content = await file.read()
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB in bytes
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # Upload to Supabase storage
        try:
            response = supabase.storage.from_(RESUME_BUCKET).upload(
                path=file_path,
                file=file_content,
                file_options={"content-type": "application/pdf"}
            )
            
            print(f"✅ Uploaded resume to Supabase: {file_path}")
            
            # Get public URL (even though bucket is private, we store the path)
            # The path will be used to retrieve the file later with signed URLs if needed
            storage_path = f"{RESUME_BUCKET}/{file_path}"
            
            return storage_path, file_path
            
        except Exception as upload_error:
            print(f"❌ Supabase upload error: {str(upload_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to upload to Supabase: {str(upload_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in upload_resume_to_supabase: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload resume: {str(e)}")


def delete_resume_from_supabase(storage_path: str) -> bool:
    """
    Delete a resume from Supabase storage.
    
    Args:
        storage_path: Full storage path (e.g., "Resume/user@example.com/uuid.pdf")
        
    Returns:
        bool: True if deletion was successful
        
    Raises:
        HTTPException: If deletion fails
    """
    try:
        # Extract the file path from storage_path
        # storage_path format: "Resume/user@example.com/uuid.pdf"
        if storage_path.startswith(f"{RESUME_BUCKET}/"):
            file_path = storage_path[len(f"{RESUME_BUCKET}/"):]
        else:
            file_path = storage_path
        
        # Delete from Supabase storage
        try:
            response = supabase.storage.from_(RESUME_BUCKET).remove([file_path])
            print(f"✅ Deleted resume from Supabase: {file_path}")
            return True
            
        except Exception as delete_error:
            print(f"❌ Supabase deletion error: {str(delete_error)}")
            # Don't raise exception if file doesn't exist
            if "not found" in str(delete_error).lower():
                print(f"⚠️ File not found in Supabase: {file_path}")
                return True
            raise HTTPException(status_code=500, detail=f"Failed to delete from Supabase: {str(delete_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in delete_resume_from_supabase: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete resume: {str(e)}")


def get_resume_download_url(storage_path: str, expires_in: int = 3600) -> str:
    """
    Get a signed URL for downloading a resume (valid for limited time).
    
    Args:
        storage_path: Full storage path (e.g., "Resume/user@example.com/uuid.pdf")
        expires_in: URL expiration time in seconds (default: 1 hour)
        
    Returns:
        str: Signed download URL
        
    Raises:
        HTTPException: If URL generation fails
    """
    try:
        # Extract the file path from storage_path
        if storage_path.startswith(f"{RESUME_BUCKET}/"):
            file_path = storage_path[len(f"{RESUME_BUCKET}/"):]
        else:
            file_path = storage_path
        
        # Create signed URL
        try:
            signed_url = supabase.storage.from_(RESUME_BUCKET).create_signed_url(
                path=file_path,
                expires_in=expires_in
            )
            
            if signed_url and 'signedURL' in signed_url:
                return signed_url['signedURL']
            else:
                raise HTTPException(status_code=500, detail="Failed to generate signed URL")
                
        except Exception as url_error:
            print(f"❌ Supabase signed URL error: {str(url_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(url_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_resume_download_url: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get download URL: {str(e)}")


__all__ = ['upload_resume_to_supabase', 'delete_resume_from_supabase', 'get_resume_download_url']

